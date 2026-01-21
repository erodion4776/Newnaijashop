
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
  SplitSquareVertical
} from 'lucide-react';
import { Sale, SaleItem } from '../types';

const ActivityLog: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Calculate start and end of selected date for the query
  const dateRange = useMemo(() => {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);
    return { start: start.getTime(), end: end.getTime() };
  }, [selectedDate]);

  // Fetch settings for receipt generation
  const settings = useLiveQuery(() => db.settings.get('app_settings'));

  // Fetch sales for selected date
  const sales = useLiveQuery(
    () => db.sales.where('timestamp').between(dateRange.start, dateRange.end).reverse().toArray(),
    [dateRange]
  );

  const isLoading = sales === undefined;

  const filteredSales = useMemo(() => {
    if (!sales) return [];
    if (!searchTerm) return sales;
    const term = searchTerm.toLowerCase();
    return sales.filter(s => 
      s.id?.toString().includes(term) || 
      s.staff_id?.toLowerCase().includes(term) ||
      s.payment_method.toLowerCase().includes(term)
    );
  }, [sales, searchTerm]);

  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((acc, sale) => acc + sale.total_amount, 0);
  }, [filteredSales]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return date.toLocaleDateString('en-NG', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const shareReceipt = (sale: Sale) => {
    const itemsText = sale.items.map(i => `• ${i.name} (${i.quantity}x) - ₦${(i.price * i.quantity).toLocaleString()}`).join('\n');
    const message = `🏪 *${settings?.shop_name || 'NaijaShop'} RECEIPT*\n` +
      `--------------------------\n` +
      `*Sale ID:* #${sale.id}\n` +
      `*Date:* ${new Date(sale.timestamp).toLocaleString()}\n` +
      `--------------------------\n` +
      `${itemsText}\n` +
      `--------------------------\n` +
      `*TOTAL: ₦${sale.total_amount.toLocaleString()}*\n` +
      `--------------------------\n` +
      `*Payment:* ${sale.payment_method.toUpperCase()}\n` +
      `*Attendant:* ${sale.staff_id}\n\n` +
      `Thank you for your patronage! 🇳🇬`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const printReceipt = () => {
    window.print();
  };

  const getPaymentIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'cash': return <Banknote size={14} />;
      case 'transfer':
      case 'bank transfer': return <Landmark size={14} />;
      case 'pos': return <CreditCard size={14} />;
      case 'split':
      case 'debt': return <Users size={14} />;
      default: return <Receipt size={14} />;
    }
  };

  const getPaymentStyle = (method: string) => {
    switch (method.toLowerCase()) {
      case 'cash': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'transfer':
      case 'bank transfer': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'pos': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'split':
      case 'debt': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Date Filter and Summary */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <div className="flex items-center gap-4 bg-white p-2 pl-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <Calendar className="text-slate-400" size={18} />
          <input 
            type="date" 
            className="py-3 pr-6 bg-transparent outline-none font-bold text-slate-800 cursor-pointer"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1 lg:flex-none bg-emerald-600 rounded-[2rem] p-4 px-8 text-white shadow-xl shadow-emerald-600/20 flex items-center gap-6">
            <div className="p-3 bg-white/20 rounded-2xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Date Revenue</p>
              <p className="text-2xl font-black tracking-tighter">₦{totalRevenue.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="hidden sm:flex bg-white rounded-[2rem] p-4 px-8 border border-slate-200 shadow-sm items-center gap-6">
            <div className="p-3 bg-slate-100 text-slate-400 rounded-2xl">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Sales</p>
              <p className="text-2xl font-black tracking-tighter text-slate-800">{filteredSales.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Search by Sale ID, Staff, or Payment Method..." 
          className="w-full h-16 pl-14 pr-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm outline-none font-medium focus:ring-2 focus:ring-emerald-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Sales List */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600">
              <History size={20} />
            </div>
            <h3 className="font-black text-slate-800 text-lg">Sales for {formatDate(dateRange.start)}</h3>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-emerald-600" size={40} />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Fetching Records...</p>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="py-32 text-center space-y-4">
            <Receipt size={64} className="mx-auto text-slate-100" />
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No sales recorded for this date</p>
              <p className="text-slate-300 text-sm font-medium mt-1">Change the date or search term to find records.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sale ID</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale) => (
                  <tr 
                    key={sale.id} 
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    onClick={() => setSelectedSale(sale)}
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Clock size={14} className="text-slate-300" />
                        <span className="text-xs font-bold tabular-nums">
                          {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <p className="font-bold text-slate-800">#SAL-{sale.id}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <User size={10} className="text-slate-300" />
                        <span className="text-[9px] text-slate-400 font-black uppercase">{sale.staff_id}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <p className="font-black text-slate-900">₦{sale.total_amount.toLocaleString()}</p>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getPaymentStyle(sale.payment_method)}`}>
                        {getPaymentIcon(sale.payment_method)}
                        {sale.payment_method}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button className="p-2.5 bg-slate-50 text-slate-400 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sale Detail Modal (Digital Receipt) */}
      {selectedSale && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Sale Details</h3>
              <button onClick={() => setSelectedSale(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 pt-0 receipt-print-area">
              {/* Receipt Header */}
              <div className="text-center py-8 space-y-2">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl p-3 flex items-center justify-center mx-auto mb-4 border border-slate-100">
                  <Receipt className="text-emerald-600" size={32} />
                </div>
                <h4 className="text-2xl font-black text-slate-900">{settings?.shop_name || 'NaijaShop POS'}</h4>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Digital Audit Receipt</p>
                <p className="text-[10px] text-slate-300">ID: SAL-{selectedSale.id} • {new Date(selectedSale.timestamp).toLocaleString()}</p>
              </div>

              {/* Items Table */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2 px-2">
                  <span>Item Description</span>
                  <span>Amount</span>
                </div>
                <div className="space-y-3">
                  {selectedSale.items.map((item: SaleItem, idx: number) => (
                    <div key={idx} className="flex justify-between items-start px-2">
                      <div className="flex-1 pr-4">
                        <p className="font-bold text-slate-800 text-sm leading-tight">{item.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">₦{item.price.toLocaleString()} x {item.quantity}</p>
                      </div>
                      <p className="font-black text-slate-900 text-sm whitespace-nowrap">₦{(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="mt-8 pt-6 border-t-2 border-dashed border-slate-100 space-y-3 px-2">
                <div className="flex justify-between items-center text-slate-400 font-bold text-sm">
                  <span>Subtotal</span>
                  <span>₦{selectedSale.total_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 font-bold text-sm">
                  <span>Discount</span>
                  <span>₦0.00</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-lg font-black text-slate-900">Total Paid</span>
                  <span className="text-2xl font-black text-emerald-600 tracking-tighter">₦{selectedSale.total_amount.toLocaleString()}</span>
                </div>
              </div>

              {/* Meta Info */}
              <div className="mt-8 p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-100">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                  <span className="text-slate-400">Payment Method</span>
                  <span className="text-slate-800">{selectedSale.payment_method.toUpperCase()}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                  <span className="text-slate-400">Attending Staff</span>
                  <span className="text-slate-800">{selectedSale.staff_id}</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 grid grid-cols-2 gap-3 shrink-0">
              <button 
                onClick={printReceipt}
                className="flex items-center justify-center gap-2 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm"
              >
                <Printer size={18} /> Print
              </button>
              <button 
                onClick={() => shareReceipt(selectedSale)}
                className="flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20"
              >
                <Share2 size={18} /> Share WA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for print mode */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .receipt-print-area, .receipt-print-area * { visibility: visible; }
          .receipt-print-area {
            position: fixed;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 5mm;
            background: white;
            font-family: 'Courier New', Courier, monospace;
          }
          .receipt-print-area button, .receipt-print-area svg { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default ActivityLog;
