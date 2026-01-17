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

// Ensure InventoryLog type has all required properties
// Add this to your types.ts if not present:
/*
export interface InventoryLog {
  id?: number;
  product_id: number;
  product_name: string;
  old_stock: number;
  new_stock: number;
  quantity_changed: number;
  type: 'restock' | 'sale' | 'adjustment' | 'sync' | 'manual';
  performed_by: string;
  timestamp: number;
  notes?: string;
}
*/

type LogType = 'all' | 'restock' | 'sale' | 'adjustment' | 'sync' | 'manual';

const InventoryLedger: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<LogType>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50); // Pagination

  // Fixed: Use orderBy for reliable ordering
  const logs = useLiveQuery(
    () => db.inventory_logs.orderBy('timestamp').reverse().toArray(),
    [],
    [] // Default value while loading
  );

  // Loading state detection
  const isLoading = logs === undefined;

  // Filter logs by search and type
  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    
    return logs.filter(log => {
      const matchesSearch = log.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           log.performed_by.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || log.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [logs, searchTerm, filterType]);

  // Paginated logs
  const visibleLogs = useMemo(() => {
    return filteredLogs.slice(0, visibleCount);
  }, [filteredLogs, visibleCount]);

  // Group by date
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

  // Stats
  const stats = useMemo(() => {
    if (!logs || logs.length === 0) return { restocks: 0, sales: 0, adjustments: 0 };
    
    return {
      restocks: logs.filter(l => l.type === 'restock').length,
      sales: logs.filter(l => l.type === 'sale').length,
      adjustments: logs.filter(l => l.type === 'adjustment' || l.type === 'manual').length,
    };
  }, [logs]);

  // Log type styling
  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'restock':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'sale':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'adjustment':
      case 'manual':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'sync':
        return 'bg-purple-50 text-purple-700 border-purple-100';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const loadMore = () => {
    setVisibleCount(prev => prev + 50);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('all');
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 size={48} className="animate-spin text-emerald-600 mb-4" />
        <p className="text-slate-500 font-medium">Loading inventory history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-xl">
              <History size={18} className="text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800">{logs?.length || 0}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total Records</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <ArrowUp size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-600">{stats.restocks}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Restocks</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <ArrowDown size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-blue-600">{stats.sales}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Sales</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <ClipboardList size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-amber-600">{stats.adjustments}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Adjustments</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search product or staff..." 
            className="w-full pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
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
          {/* Filter Toggle */}
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border font-bold text-sm transition-all ${
              filterType !== 'all' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <Filter size={16} />
            Filter
            {filterType !== 'all' && (
              <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] rounded-full uppercase">
                {filterType}
              </span>
            )}
          </button>

          {/* Clear Filters */}
          {(searchTerm || filterType !== 'all') && (
            <button 
              onClick={clearFilters}
              className="px-4 py-3 bg-rose-50 text-rose-600 rounded-xl font-bold text-sm border border-rose-100"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter Dropdown */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 animate-in slide-in-from-top-2">
          <p className="text-xs font-bold text-slate-400 uppercase mb-3">Filter by Type</p>
          <div className="flex flex-wrap gap-2">
            {(['all', 'restock', 'sale', 'adjustment', 'sync', 'manual'] as LogType[]).map(type => (
              <button
                key={type}
                onClick={() => {
                  setFilterType(type);
                  setShowFilters(false);
                }}
                className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all ${
                  filterType === type
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type === 'all' ? 'All Types' : type}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results Count */}
      {(searchTerm || filterType !== 'all') && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium">
          <AlertCircle size={16} />
          Showing {filteredLogs.length} of {logs?.length || 0} records
        </div>
      )}

      {/* Logs List */}
      <div className="space-y-8">
        {Object.entries(groupedLogs).map(([date, items]) => (
          <div key={date} className="space-y-4">
            <h3 className="flex items-center gap-3 text-sm font-black text-slate-400 uppercase tracking-[0.2em] px-2">
              <Calendar size={14} /> {date}
              <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-full normal-case tracking-normal">
                {items.length} entries
              </span>
            </h3>
            
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Change</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Flow</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff</th>
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
                          <p className="text-[10px] text-slate-400 font-bold uppercase">ID: #{log.product_id}</p>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="text-center min-w-[50px]">
                              <p className="text-[10px] text-slate-400 font-black uppercase">Old</p>
                              <p className="font-bold text-slate-600">{log.old_stock}</p>
                            </div>
                            <div className="h-8 w-px bg-slate-200" />
                            <div className="text-center min-w-[50px]">
                              <p className="text-[10px] text-slate-400 font-black uppercase">New</p>
                              <p className="font-black text-slate-900">{log.new_stock}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center justify-center">
                            <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 border ${
                              log.quantity_changed >= 0 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                : 'bg-rose-50 text-rose-700 border-rose-100'
                            }`}>
                              {log.quantity_changed >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                              <span className="text-sm font-black tabular-nums">
                                {log.quantity_changed >= 0 ? '+' : ''}{log.quantity_changed}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-slate-600">
                              <User size={14} />
                              <span className="text-xs font-bold">{log.performed_by}</span>
                            </div>
                            <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${getTypeStyle(log.type)}`}>
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

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {items.map((log) => (
                <div key={log.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-slate-800">{log.product_name}</p>
                      <p className="text-[10px] text-slate-400 font-bold">ID: #{log.product_id}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${getTypeStyle(log.type)}`}>
                      {log.type}
                    </span>
                  </div>

                  {/* Stock Change */}
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 font-bold">OLD</p>
                      <p className="text-lg font-bold text-slate-600">{log.old_stock}</p>
                    </div>
                    <div className={`px-4 py-2 rounded-xl flex items-center gap-1 ${
                      log.quantity_changed >= 0 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {log.quantity_changed >= 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                      <span className="font-black">
                        {log.quantity_changed >= 0 ? '+' : ''}{log.quantity_changed}
                      </span>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 font-bold">NEW</p>
                      <p className="text-lg font-black text-slate-900">{log.new_stock}</p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <User size={12} />
                      <span className="font-medium">{log.performed_by}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      <span className="font-medium tabular-nums">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Load More Button */}
        {visibleCount < filteredLogs.length && (
          <div className="flex justify-center pt-4">
            <button
              onClick={loadMore}
              className="flex items-center gap-2 px-8 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-600 transition-all"
            >
              <ChevronDown size={18} />
              Load More ({filteredLogs.length - visibleCount} remaining)
            </button>
          </div>
        )}

        {/* Empty States */}
        {logs && logs.length > 0 && filteredLogs.length === 0 && (
          <div className="py-20 text-center bg-white border border-slate-200 rounded-[3rem]">
            <Search size={48} className="mx-auto mb-4 text-slate-200" />
            <p className="text-slate-500 font-bold">No matching records found</p>
            <p className="text-xs text-slate-400 mt-1">Try a different search term or filter</p>
            <button 
              onClick={clearFilters}
              className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm"
            >
              Clear Filters
            </button>
          </div>
        )}

        {logs && logs.length === 0 && (
          <div className="py-32 text-center bg-white border border-dashed border-slate-300 rounded-[3rem]">
            <Package size={64} className="mx-auto mb-4 text-slate-200" />
            <p className="text-slate-500 font-bold">No stock movements recorded yet</p>
            <p className="text-xs text-slate-400 mt-1">Updates to inventory will appear here automatically</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryLedger;
