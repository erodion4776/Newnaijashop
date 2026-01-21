import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import LZString from 'lz-string';
import QRCode from 'qrcode';
import { 
  UserPlus, 
  Key, 
  Trash2, 
  Share2, 
  X, 
  CheckCircle2, 
  Lock, 
  ChevronRight, 
  Edit, 
  Package,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  Zap
} from 'lucide-react';
import { Staff } from '../types';
import { exportDataForWhatsApp, generateSyncKey } from '../services/syncService';

const StaffManagement: React.FC = () => {
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [staffToShare, setStaffToShare] = useState<Staff | null>(null);
  const [shareQRCode, setShareQRCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    role: 'Sales' as 'Sales' | 'Manager' | 'Admin', 
    password: '' 
  });
  
  const staffList = useLiveQuery(() => db.staff.toArray());
  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  
  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(false);
    if (!settings?.admin_pin) return alert("Admin PIN not configured.");
    if (adminPinInput === settings.admin_pin) {
      setIsAdminUnlocked(true);
    } else {
      setPinError(true);
      setAdminPinInput('');
    }
  };

  const handleGenerateMasterKey = async () => {
    if(!confirm("Regenerating the Master Key will disconnect all existing staff until they update their keys. Proceed?")) return;
    setIsGeneratingKey(true);
    await db.settings.update('app_settings', { sync_key: generateSyncKey() });
    setIsGeneratingKey(false);
  };

  const handleKeyUpdate = async (staff: Staff) => {
    if (!settings?.sync_key) return;
    setIsSyncing(true);
    try {
      const updateString = await exportDataForWhatsApp('KEY_UPDATE', settings.sync_key);
      const url = `${window.location.origin}/?importData=${updateString}`;
      const message = `🔐 NAIJASHOP SECURITY UPDATE:\n\n${staff.name}, click this link to align your security bridge with the shop terminal:\n${url}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
      showSuccess(`Security update sent to ${staff.name}`);
    } catch (err) {
      alert("Failed to send key update.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendStockUpdate = async (staff: Staff) => {
    if (!settings?.sync_key) return;
    setIsSyncing(true);
    try {
      const compressed = await exportDataForWhatsApp('STOCK', settings.sync_key);
      const magicLink = `${window.location.origin}/?importData=${compressed}`;
      const message = `🏪 NAIJASHOP STOCK UPDATE (${new Date().toLocaleDateString()}):\n\n${staff.name}, click this link to update your terminal inventory:\n${magicLink}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
      showSuccess(`Stock update sent to ${staff.name}`);
    } catch (err) {
      alert("Failed to send update: " + err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingStaff?.id) {
        await db.staff.update(editingStaff.id, {
          name: formData.name.trim(),
          role: formData.role,
          password: formData.password
        });
        showSuccess(`${formData.name} updated!`);
      } else {
        await db.staff.add({
          name: formData.name.trim(),
          role: formData.role,
          password: formData.password,
          status: 'Active',
          created_at: Date.now()
        });
        showSuccess(`${formData.name} added!`);
      }
      closeModal();
    } catch (err) {
      alert("Error saving staff: " + err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!staffToDelete?.id) return;
    try {
      await db.staff.delete(staffToDelete.id);
      showSuccess(`${staffToDelete.name} removed`);
      setIsDeleteModalOpen(false);
      setStaffToDelete(null);
    } catch (err) {
      alert("Error deleting staff: " + err);
    }
  };

  const openShareModal = async (staff: Staff) => {
    if (!settings?.sync_key) return;
    setStaffToShare(staff);
    setIsShareModalOpen(true);
    const onboarding = LZString.compressToEncodedURIComponent(JSON.stringify({
      shop: settings?.shop_name,
      name: staff.name,
      role: staff.role,
      password: staff.password,
      syncKey: settings?.sync_key
    }));
    const url = `${window.location.origin}/?staffData=${onboarding}`;
    try {
      const qrDataUrl = await QRCode.toDataURL(url, { width: 256, margin: 2 });
      setShareQRCode(qrDataUrl);
    } catch (err) { console.error(err); }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStaff(null);
    setFormData({ name: '', role: 'Sales', password: '' });
  };

  const openEditModal = (staff: Staff) => {
    setEditingStaff(staff);
    setFormData({ name: staff.name, role: staff.role, password: staff.password });
    setIsModalOpen(true);
  };

  if (!isAdminUnlocked) {
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-200 text-center space-y-8 animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner"><Lock size={40} /></div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800">Admin Authentication</h2>
            <p className="text-slate-400 text-sm font-medium">Verify your identity to manage staff records.</p>
          </div>
          <form onSubmit={handleAdminAuth} className="space-y-4">
            <input type="password" inputMode="numeric" maxLength={4} placeholder="••••" className={`w-full px-6 py-5 bg-slate-50 border rounded-[2rem] outline-none focus:ring-2 focus:ring-emerald-500 font-black text-4xl text-center tracking-[0.5em] transition-colors ${pinError ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`} value={adminPinInput} onChange={(e) => { setPinError(false); setAdminPinInput(e.target.value.replace(/\D/g, '')); }} autoFocus />
            <button type="submit" disabled={adminPinInput.length < 4} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50">Continue <ChevronRight size={20} /></button>
          </form>
        </div>
      </div>
    );
  }

  const isKeyMissing = !settings?.sync_key;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {successMessage && (
        <div className="fixed top-4 right-4 z-[200] bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <CheckCircle2 size={20} /> <span className="font-bold">{successMessage}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Staff Registry</h3>
          <p className="text-sm text-slate-500 font-medium">Manage terminals and access</p>
        </div>
        <button onClick={() => { setEditingStaff(null); setFormData({ name: '', role: 'Sales', password: '' }); setIsModalOpen(true); }} className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20"><UserPlus size={20} /> Add Staff</button>
      </div>

      {isKeyMissing && (
        <div className="bg-rose-50 border-2 border-dashed border-rose-200 rounded-[2.5rem] p-10 text-center space-y-6">
           <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldAlert size={32} />
           </div>
           <div className="max-w-md mx-auto space-y-2">
             <h4 className="text-xl font-black text-slate-900">Security Key Required</h4>
             <p className="text-sm text-slate-500 font-medium leading-relaxed">You must generate a Master Sync Key before inviting staff.</p>
           </div>
           <button onClick={handleGenerateMasterKey} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-black transition-all flex items-center gap-2 mx-auto">
              <RefreshCw /> Generate Master Key
           </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {(staffList || []).map((staff) => (
          <div key={staff.id} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:border-emerald-200 transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center font-black text-xl group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">{staff.name.charAt(0).toUpperCase()}</div>
              <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${staff.role === 'Admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{staff.role}</span>
            </div>

            <div className="space-y-3">
              <h4 className="font-black text-xl text-slate-800">{staff.name}</h4>
              <p className="text-xs text-slate-400 font-bold">Password: <span className="font-mono text-slate-900 ml-1">{staff.password}</span></p>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button onClick={() => openEditModal(staff)} className="p-2.5 text-slate-400 hover:text-blue-600 transition-all"><Edit size={18} /></button>
                <button onClick={() => { setStaffToDelete(staff); setIsDeleteModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-rose-600 transition-all"><Trash2 size={18} /></button>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleKeyUpdate(staff)}
                  title="Emergency Key Update"
                  disabled={isKeyMissing}
                  className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all disabled:opacity-30"
                >
                  <Zap size={18} />
                </button>
                <button 
                  onClick={() => handleSendStockUpdate(staff)} 
                  disabled={isKeyMissing} 
                  className="p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all disabled:opacity-30"
                >
                  <Package size={18} />
                </button>
                <button 
                  onClick={() => openShareModal(staff)} 
                  disabled={isKeyMissing}
                  className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-30 shadow-lg"
                >
                  <Share2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900">{editingStaff ? 'Update Staff' : 'Add New Staff'}</h3>
              <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <input required type="text" placeholder="Full Name" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              <select className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value as any})}>
                <option value="Sales">Sales Attendant</option>
                <option value="Manager">Shop Manager</option>
                <option value="Admin">Co-Admin</option>
              </select>
              <input required type="text" placeholder="Access PIN / Password" minLength={4} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
              <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black shadow-xl hover:bg-emerald-700 transition-all">
                {isSubmitting ? 'Processing...' : editingStaff ? 'Save Changes' : 'Register Staff'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
           <div className="bg-white p-8 rounded-[3rem] text-center space-y-6 w-full max-w-sm animate-in zoom-in">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><AlertTriangle size={40} /></div>
              <h3 className="text-2xl font-black text-slate-900">Delete Account?</h3>
              <p className="text-slate-500 font-medium">This will remove their terminal access permanently.</p>
              <div className="flex gap-4">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
                <button onClick={handleDeleteStaff} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Delete</button>
              </div>
           </div>
        </div>
      )}

      {isShareModalOpen && staffToShare && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-sm shadow-2xl animate-in zoom-in p-10 text-center space-y-8">
             <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Generate Invite</h3>
                <p className="text-sm text-slate-500 font-medium">Send secure link to {staffToShare.name}</p>
             </div>
             
             {shareQRCode && (
               <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 inline-block shadow-inner">
                  <img src={shareQRCode} alt="Invite QR" className="w-48 h-48 mx-auto mix-blend-multiply" />
               </div>
             )}

             <div className="space-y-3">
               <button 
                  onClick={() => {
                    const onboarding = LZString.compressToEncodedURIComponent(JSON.stringify({
                      shop: settings?.shop_name,
                      name: staffToShare.name,
                      role: staffToShare.role,
                      password: staffToShare.password,
                      syncKey: settings?.sync_key
                    }));
                    const url = `${window.location.origin}/?staffData=${onboarding}`;
                    const message = `🏪 NAIJASHOP INVITE (${settings?.shop_name})\n\n${staffToShare.name}, click this link to join our shop terminal:\n${url}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                  }}
                  className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-3"
               >
                 <Share2 size={24} /> Share via WhatsApp
               </button>
               <button onClick={() => setIsShareModalOpen(false)} className="w-full py-4 text-slate-400 font-bold text-xs uppercase tracking-widest">Close</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;