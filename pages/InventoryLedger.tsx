
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
  Filter
} from 'lucide-react';
import { InventoryLog } from '../types';

const InventoryLedger: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const logs = useLiveQuery(() => db.inventory_logs.reverse().toArray()) || [];

  const filteredLogs = useMemo(() => {
    return logs.filter(log => 
      log.product_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [logs, searchTerm]);

  // Helper to group by date
  const groupedLogs = useMemo(() => {
    const groups: { [key: string]: InventoryLog[] } = {};
    filteredLogs.forEach(log => {
      const date = new Date(log.timestamp);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      let dateKey = date.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      
      if (date.toDateString() === today.toDateString()) dateKey = "Today";
      else if (date.toDateString() === yesterday.toDateString()) dateKey = "Yesterday";

      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(log);
    });
    return groups;
  }, [filteredLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by product name..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-black uppercase tracking-widest">
           <History size={14} /> {logs.length} Total Audit Records
        </div>
      </div>

      <div className="space-y-10">
        {/* Fix: Explicitly cast Object.entries to resolve 'unknown' type for log items array */}
        {(Object.entries(groupedLogs) as [string, InventoryLog[]][]).map(([date, items]) => (
          <div key={date} className="space-y-4">
            <h3 className="flex items-center gap-3 text-sm font-black text-slate-400 uppercase tracking-[0.2em] px-2">
               <Calendar size={14} /> {date}
            </h3>
            
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
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
                    {/* Fix: items is correctly recognized as InventoryLog[] after cast above */}
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
                            <div className="h-8 w-px bg-slate-100" />
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
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">
                                  {log.type}
                                </span>
                              </div>
                           </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2 text-slate-500">
                            <User size={14} />
                            <span className="text-xs font-bold">{log.performed_by}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}

        {filteredLogs.length === 0 && (
          <div className="py-32 text-center bg-white border border-dashed border-slate-300 rounded-[3rem]">
            <History size={64} className="mx-auto mb-4 opacity-10" />
            <p className="text-slate-500 font-bold">No stock movements recorded yet</p>
            <p className="text-xs text-slate-400 mt-1">Updates to inventory will appear here automatically</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryLedger;
