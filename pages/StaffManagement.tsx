
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  UserCog, 
  UserPlus, 
  Shield, 
  Key, 
  Smartphone, 
  Trash2, 
  Share2, 
  X, 
  MessageCircle,
  CheckCircle2,
  Lock,
  ChevronRight
} from 'lucide-react';
import { Staff } from '../types';

const StaffManagement: React.FC = () => {
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', role: 'Sales', password: '' });
  
  const staffList = useLiveQuery(() => db.staff.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get('app_settings'));

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPinInput === settings?.admin_pin) {
      setIsAdminUnlocked(true);
    } else {
      alert("Invalid Admin PIN");
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.staff.add({
      ...formData,
      role: formData.role as any,
      status: 'Active',
      created_at: Date.now()
    });
    setIsModalOpen(false);
    setFormData({ name: '', role: 'Sales', password: '' });
  };

  const generateOnboardingLink = (staff: Staff) => {
    const data = {
      name: staff.name,
      role: staff.role,
      password: staff.password,
      shop: settings?.shop_name
    };
    const b64 = btoa(JSON.stringify(data));
    // Updated to use staffData as per requirements
    const url = `${window.location.origin}/login?staffData=${b64}`;
    
    const message = `Hello ${staff.name}, your account for ${settings?.shop_name} is ready. Click this magic link to join the terminal: ${url}`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  if (!isAdminUnlocked) {
    return (
      <div className="max-w-md mx-auto py-20 px-6">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-200 text-center space-y-8 animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <Lock size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800">Admin Authentication</h2>
            <p className="text-slate-400 text-sm font-medium">Enter your Secure Admin PIN to manage staff records.</p>
          </div>
          <form onSubmit={handleAdminAuth} className="space-y-4">
            <input 
              type="password" 
              maxLength={4}
              placeholder="****"
              className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] outline-none focus:ring-2 focus:ring-emerald-500 font-black text-4xl text-center tracking-[0.5em]"
              value={adminPinInput}
              onChange={(e) => setAdminPinInput(e.target.value)}
              autoFocus
            />
            <button 
              type="submit"
              className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg hover:bg-black transition-all flex items-center justify-center gap-2"
            >
              Access Management <ChevronRight size={20} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Terminal Staff Registry</h3>
          <p className="text-sm text-slate-500 font-medium">Create accounts and generate magic onboarding links</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20"
        >
          <UserPlus size={20} />
          New Staff Entry
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staffList.map((staff) => (
          <div key={staff.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:border-emerald-200 transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 bg-slate-100 text-slate-800 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                {staff.name.charAt(0)}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${
                  staff.role === 'Admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                  staff.role === 'Manager' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  'bg-emerald-50 text-emerald-700 border-emerald-100'
                }`}>
                  {staff.role}
                </span>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active since {new Date(staff.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-black text-xl text-slate-800">{staff.name}</h4>
              <div className="flex items-center gap-2 text-slate-400 text-sm font-bold bg-slate-50 p-3 rounded-xl border border-slate-100">
                <Key size={14} />
                <span className="font-mono">••••••••</span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
              <button 
                onClick={() => { if(confirm("Delete staff member?")) db.staff.delete(staff.id!) }}
                className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
              >
                <Trash2 size={20} />
              </button>
              <button 
                onClick={() => generateOnboardingLink(staff)}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
              >
                <Share2 size={16} />
                Share Link
              </button>
            </div>
          </div>
        ))}

        {staffList.length === 0 && (
          <div className="col-span-full py-32 text-center bg-white border border-dashed border-slate-300 rounded-[3rem] space-y-4">
            <UserCog size={64} className="mx-auto text-slate-100" />
            <div>
              <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No Staff Members Registered</p>
              <p className="text-slate-300 text-sm font-medium mt-1">Start by adding your first sales or manager entry</p>
            </div>
          </div>
        )}
      </div>

      {/* New Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Staff Account Setup</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddStaff} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Full Name</label>
                  <input 
                    required
                    autoFocus
                    type="text" 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Assign Role</label>
                  <select 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                  >
                    <option value="Sales">Sales Personnel</option>
                    <option value="Manager">Shop Manager</option>
                    <option value="Admin">Co-Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Login Password</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              </div>
              <button 
                type="submit" 
                className="w-full py-5 rounded-[2rem] font-black text-xl text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-600/30"
              >
                Save & Generate Link
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
