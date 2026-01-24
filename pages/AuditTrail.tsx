
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  ShieldAlert, 
  Search, 
  Calendar, 
  User, 
  Clock, 
  FileText, 
  Trash2, 
  X,
  AlertTriangle,
  History,
  Info
} from 'lucide-react';
import { AuditEntry } from '../types';

const AuditTrail: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const auditLogs = useLiveQuery(
    () => db.audit_trail.orderBy('timestamp').reverse().toArray()
  ) || [];

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           log.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           log.details.toLowerCase().includes(searchTerm.toLowerCase());
      
      const logDate = new Date(log.timestamp).toISOString().split('T')[0];
      const matchesDate = !selectedDate || logDate === selectedDate;

      return matchesSearch && matchesDate;
    });
  }, [auditLogs, searchTerm, selectedDate]);

  const clearLogs = async () => {
    if (confirm("DANGER: This will permanently delete all security logs. This action itself will be logged. Continue?")) {
      const staffName = "Admin"; // In a real app, get current user
      await db.audit_trail.clear();
      await db.audit_trail.add({
        action: 'Audit Logs Cleared',
        details: 'All previous security logs were manually cleared by Admin.',
        staff_name: staffName,
        timestamp: Date.now()
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <ShieldAlert className="text-rose-600" /> Security Audit Trail
          </h3>
          <p className="text-sm text-slate-500 font-medium">Monitoring sensitive shop activities and terminal overrides</p>
        </div>
        <button 
          onClick={clearLogs}
          className="flex items-center gap-2 px-6 py-3 bg-white border border-rose-100 text-rose-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-50 transition-all"
        >
          <Trash2 size={16} /> Clear Logs
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search actions, staff or details..." 
            className="w-full pl-12 pr-4 h-14 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4 bg-white p-1 pl-6 rounded-2xl border border-slate-200 shadow-sm">
          <Calendar className="text-slate-400" size={18} />
          <input 
            type="date" 
            className="flex-1 py-3 pr-4 bg-transparent outline-none font-bold text-slate-800" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
          />
          {selectedDate && (
            <button onClick={() => setSelectedDate('')} className="p-3 text-slate-300 hover:text-slate-500"><X size={18} /></button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {filteredLogs.map((log) => (
          <div key={log.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-rose-200 transition-all">
            <div className="flex gap-4 items-start">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                log.action.includes('Price') ? 'bg-blue-50 text-blue-600' :
                log.action.includes('Delete') ? 'bg-rose-50 text-rose-600' :
                log.action.includes('Stock') ? 'bg-amber-50 text-amber-600' :
                'bg-slate-50 text-slate-600'
              }`}>
                <Info size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">{log.action}</h4>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  {log.details}
                </p>
              </div>
            </div>
            
            <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-8 shrink-0 gap-1">
              <div className="flex items-center gap-2 text-slate-900 font-black text-xs uppercase tracking-tight">
                <User size={14} className="text-slate-400" />
                {log.staff_name}
              </div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                {new Date(log.timestamp).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}

        {filteredLogs.length === 0 && (
          <div className="py-32 text-center bg-white border border-dashed border-slate-300 rounded-[3rem] space-y-4">
            <History size={64} className="mx-auto text-slate-100" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No security events found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditTrail;
