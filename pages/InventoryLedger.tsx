
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  ClipboardList, 
  Search, 
  ArrowUp, 
  ArrowDown, 
  User, 
  Calendar,
  History,
  Filter,
  Loader2,
  AlertCircle,
  Package,
  Clock,
  ChevronDown,
  X
} from 'lucide-react';
import { InventoryLog } from '../types';

type LogType = 'All' | 'Restock' | 'Sale' | 'Adjustment' | 'Sync' | 'Manual' | 'Initial Stock' | 'Return';

const InventoryLedger: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<LogType>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50); // Pagination

  // Use Dexie's orderBy and reverse for efficient descending chronological order
  const logs = useLiveQuery(
    () => db.inventory_logs.orderBy('timestamp').reverse().toArray(),
    []
  );

  // Loading state detection
  const isLoading = logs === undefined;

  // Filter logs by search (product name or staff) and log type
  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    
    return logs.filter(log => {
      const matchesSearch = log.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           log.performed_by.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'All' || log.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [logs, searchTerm, filterType]);

  // Paginated logs for performance with large datasets
  const visibleLogs = useMemo(() => {
    return filteredLogs.slice(0, visibleCount);
  }, [filteredLogs, visibleCount]);

  // Group logs by date for improved readability
  const groupedLogs = useMemo(() => {
    const groups: { [key: string]: InventoryLog[] } = {};
    
    visibleLogs.forEach(log => {
      const date = new Date(log.timestamp);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      let dateKey: string;
      
      if (date.toDateString() === today.toDateString()) {
        dateKey = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateKey = "Yesterday";
      } else {
        dateKey = date.toLocaleDateString('en-NG', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        });
      }

      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(log);
    });
    
    return groups;
  }, [visibleLogs]);

  // Quick summary statistics
  const stats = useMemo(() => {
    if (!logs || logs.length === 0) return { restocks: 0, sales: 0, adjustments: 0 };
    
    return {
      restocks: logs.filter(l => l.type === 'Restock' || l.type === 'Initial Stock').length,
      sales: logs.filter(l => l.type === 'Sale').length,
      adjustments: logs.filter(l => l.type === 'Adjustment' || l.type === 'Return').length,
    };
  }, [logs]);

  // Consistent color coding for different log types
  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'Restock':
      case 'Initial Stock':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Sale':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Adjustment':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'Sync':
        return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'Return':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const loadMore = () => {
    setVisibleCount(prev => prev + 50);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('All');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 size={48} className="animate-spin text-emerald-600 mb-4" />
        <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Accessing Audit Trail...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-xl">
              <History size={18} className="text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800 tracking-tighter">{logs?.length || 0}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logs</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl">
              <ArrowUp size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-600 tracking-tighter">{stats.restocks}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Restocks</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-xl">
              <ArrowDown size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-blue-600 tracking-tighter">{stats.sales}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sales</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl">
              <ClipboardList size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-amber-600 tracking-tighter">{stats.adjustments}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Adj.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Find product or staff..." 
            className="w-full pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-lg"
            >
              <X size={16} className="text-slate-400" />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all ${
              filterType !== 'All' 
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' 
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <Filter size={14} />
            Filter
            {filterType !== 'All' && (
              <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-md">
                {filterType}
              </span>
            )}
          </button>

          {(searchTerm || filterType !== 'All') && (
            <button 
              onClick={clearFilters}
              className="px-4 py-3 bg-rose-50 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-rose-100"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter Options Panel */}
      {showFilters && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 animate-in slide-in-from-top-2 shadow-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Select Log Type</p>
          <div className="flex flex-wrap gap-2">
            {(['All', 'Restock', 'Sale', 'Adjustment', 'Sync', 'Manual', 'Initial Stock', 'Return'] as LogType[]).map(type => (
              <button
                key={type}
                onClick={() => {
                  setFilterType(type);
                  setShowFilters(false);
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  filterType === type
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Audit Log Timeline */}
      <div className="space-y-8">
        {/* Fix: Explicitly cast Object.entries to correct type to avoid 'unknown' type inference on 'items' */}
        {(Object.entries(groupedLogs) as [string, InventoryLog[]][]).map(([date, items]) => (
          <div key={date} className="space-y-4">
            <h3 className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">
              <Calendar size={14} /> {date}
              <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded-full normal-case tracking-normal text-slate-500">
                {items.length} records
              </span>
            </h3>
            
            {/* Desktop Table: Comprehensive View */}
            <div className="hidden md:block bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Change</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Movement</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Authority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-5">
                          <span className="text-xs font-bold text-slate-500 tabular-nums">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <p className="font-bold text-slate-800">{log.product_name}</p>
                          <p className="text-[9px] text-slate-400 font-black uppercase">SKU: #{log.product_id}</p>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="text-[9px] text-slate-400 font-black uppercase">Old</p>
                              <p className="font-bold text-slate-600">{log.old_stock}</p>
                            </div>
                            <div className="h-6 w-px bg-slate-200" />
                            <div className="text-center">
                              <p className="text-[9px] text-slate-400 font-black uppercase">New</p>
                              <p className="font-black text-slate-900">{log.new_stock}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center justify-center">
                            <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 border font-black tabular-nums text-xs ${
                              log.quantity_changed >= 0 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                : 'bg-rose-50 text-rose-700 border-rose-100'
                            }`}>
                              {log.quantity_changed >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                              {log.quantity_changed >= 0 ? '+' : ''}{log.quantity_changed}
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-slate-600">
                              <User size={12} className="text-slate-400" />
                              <span className="text-xs font-bold">{log.performed_by}</span>
                            </div>
                            <span className={`inline-block px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border tracking-widest ${getTypeStyle(log.type)}`}>
                              {log.type}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards: Compact Layout */}
            <div className="md:hidden space-y-3">
              {items.map((log) => (
                <div key={log.id} className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-slate-800">{log.product_name}</p>
                      <p className="text-[9px] text-slate-400 font-black uppercase">SKU: #{log.product_id}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase border tracking-widest ${getTypeStyle(log.type)}`}>
                      {log.type}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-4">
                    <div className="text-center">
                      <p className="text-[9px] text-slate-400 font-black uppercase">OLD</p>
                      <p className="text-sm font-bold text-slate-600">{log.old_stock}</p>
                    </div>
                    <div className={`px-5 py-2.5 rounded-2xl flex items-center gap-1 font-black ${
                      log.quantity_changed >= 0 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {log.quantity_changed >= 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                      {log.quantity_changed >= 0 ? '+' : ''}{log.quantity_changed}
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-slate-400 font-black uppercase">NEW</p>
                      <p className="text-sm font-black text-slate-900">{log.new_stock}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <User size={12} className="text-slate-300" />
                      <span>{log.performed_by}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-slate-300" />
                      <span className="tabular-nums">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Dynamic Pagination Loader */}
        {visibleCount < filteredLogs.length && (
          <div className="flex justify-center pt-4">
            <button
              onClick={loadMore}
              className="flex items-center gap-3 px-8 py-4 bg-white border border-slate-200 rounded-[2rem] font-black text-[10px] uppercase tracking-widest text-slate-500 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm"
            >
              <ChevronDown size={18} />
              Load More ({filteredLogs.length - visibleCount} entries remaining)
            </button>
          </div>
        )}

        {/* Filtered Empty State */}
        {logs && logs.length > 0 && filteredLogs.length === 0 && (
          <div className="py-20 text-center bg-white border border-slate-200 rounded-[3rem] shadow-sm">
            <Search size={48} className="mx-auto mb-4 text-slate-200" />
            <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No matching movements found</p>
            <button 
              onClick={clearFilters}
              className="mt-4 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Database Empty State */}
        {logs && logs.length === 0 && (
          <div className="py-32 text-center bg-white border border-dashed border-slate-300 rounded-[3rem]">
            <Package size={64} className="mx-auto mb-4 text-slate-100" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No Stock Movements Recorded</p>
            <p className="text-slate-300 text-xs mt-2 font-medium">Add products or record sales to populate the ledger.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryLedger;
