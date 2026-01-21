
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
  ShieldAlert
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
    setIsGeneratingKey(true);
    await db.settings.update('app_settings', { sync_key: generateSyncKey() });
    setIsGeneratingKey(false);
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

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return "Name is required";
    if (formData.name.trim().length < 2) return "Name must be at least 2 characters";
    if (!formData.password) return "Password is required";
    if (formData.password.length < 4) return "Password must be at least 4 characters";
    const duplicate = (staffList || []).find(
      s => s.name.toLowerCase() === formData.name.trim().toLowerCase() && s.id !== editingStaff?.id
    );
    if (duplicate) return "A staff member with this name already exists";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateForm();
    if (error) return alert(error);
    setIsSubmitting(true);
    try {
      if (editingStaff?.id) {
        await db.staff.update(editingStaff.id, {
          name: formData.name.trim(),
          role: formData.role,
          password: formData.password
        });
        showSuccess(`${formData.name} updated successfully!`);
      } else {
        await db.staff.add({
          name: formData.name.trim(),
          role: formData.role,
          password: formData.password,
          status: 'Active',
          created_at: Date.now()
        });
        showSuccess(`${formData.name} added successfully!`);
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
    if (!settings?.sync_key) return; // UI Guard should prevent this
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

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'Manager': return 'bg-amber-50 text-amber-700 border-amber-100';
      default: return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    }
  };

  if (!isAdminUnlocked) {
    return (
      <div className="max-w-md mx-auto py-12 lg:py-20 px-4">
        <div className="bg-white p-8 lg:p-10 rounded-[3rem] shadow-2xl border border-slate-200 text-center space-y-8 animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner"><Lock size={40} /></div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800">Admin Authentication</h2>
            <p className="text-slate-400 text-sm font-medium">Enter your Secure Admin PIN to manage staff records.</p>
          </div>
          <form onSubmit={handleAdminAuth} className="space-y-4">
            <input type="password" inputMode="numeric" maxLength={4} placeholder="••••" className={`w-full px-6 py-5 bg-slate-50 border rounded-[2rem] outline-none focus:ring-2 focus:ring-emerald-500 font-black text-4xl text-center tracking-[0.5em] transition-colors ${pinError ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`} value={adminPinInput} onChange={(e) => { setPinError(false); setAdminPinInput(e.target.value.replace(/\D/g, '')); }} autoFocus />
            <button type="submit" disabled={adminPinInput.length < 4} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50">Access Management <ChevronRight size={20} /></button>
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
          <p className="text-sm text-slate-500 font-medium">{(staffList || []).length} staff members enrolled</p>
        </div>
        <button onClick={() => { setEditingStaff(null); setFormData({ name: '', role: 'Sales', password: '' }); setIsModalOpen(true); }} className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20"><UserPlus size={20} /> Add Staff</button>
      </div>

      {isKeyMissing && (
        <div className="bg-rose-50 border-2 border-dashed border-rose-200 rounded-[2.5rem] p-10 text-center space-y-6">
           <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <ShieldAlert size={32} />
           </div>
           <div className="max-w-md mx-auto space-y-2">
             <h4 className="text-xl font-black text-slate-900">Security Bridge Required</h4>
             <p className="text-sm text-slate-500 font-medium leading-relaxed">You must generate a Master Sync Key before inviting staff. This key secures your sales and stock data during transfers.</p>
           </div>
           <button 
             onClick={handleGenerateMasterKey} 
             disabled={isGeneratingKey}
             className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-black transition-all flex items-center gap-2 mx-auto"
           >
              {isGeneratingKey ? <RefreshCw className="animate-spin" /> : <RefreshCw />}
              Generate Security Key
           </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
        {(staffList || []).map((staff) => (
          <div key={staff.id} className={`bg-white p-6 lg:p-8 rounded-[2rem] border shadow-sm transition-all group ${isKeyMissing ? 'opacity-50' : 'hover:border-emerald-200'}`}>
            <div className="flex justify-between items-start mb-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner transition-colors ${staff.status === 'Inactive' ? 'bg-slate-200 text-slate-400' : 'bg-slate-100 text-slate-800 group-hover:bg-emerald-50 group-hover:text-emerald-600'}`}>{staff.name.charAt(0).toUpperCase()}</div>
              <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${getRoleBadgeStyle(staff.role)}`}>{staff.role}</span>
            </div>

            <div className="space-y-3">
              <h4 className="font-black text-xl text-slate-800">{staff.name}</h4>
              <div className="flex items-center gap-2 text-slate-400 text-sm font-bold bg-slate-50 p-3 rounded-xl border border-slate-100"><Key size={14} /><span className="font-mono tracking-wider">••••••••</span></div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button onClick={() => openEditModal(staff)} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit size={18} /></button>
                <button onClick={() => { setStaffToDelete(staff); setIsDeleteModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleSendStockUpdate(staff)} 
                  disabled={isSyncing || isKeyMissing} 
                  className="p-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all disabled:opacity-30 shadow-sm flex items-center gap-1.5"
                >
                  <Package size={16} />
                </button>
                <button 
                  onClick={() => openShareModal(staff)} 
                  disabled={isKeyMissing}
                  className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-30 shadow-lg"
                >
                  <Share2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 lg:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">{editingStaff ? 'Edit Staff' : 'New Staff'}</h3>
              <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 lg:p-8 space-y-5">
              <input required autoFocus type="text" placeholder="Full Name" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              <div className="grid grid-cols-3 gap-2">
                {(['Sales', 'Manager', 'Admin'] as const).map(role => (
                  <button key={role} type="button" onClick={() => setFormData({...formData, role})} className={`py-3 rounded-xl text-xs font-bold transition-all border ${formData.role === role ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600'}`}>{role}</button>
                ))}
              </div>
              <input required type="text" placeholder="Password" minLength={4} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
              <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-xl">
                {isSubmitting ? 'Saving...' : editingStaff ? 'Save Changes' : 'Add Staff'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
           <div className="bg-white p-8 rounded-[3rem] text-center space-y-6 w-full max-w-sm animate-in zoom-in">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><AlertTriangle size={40} /></div>
              <h3 className="text-2xl font-black text-slate-900">Remove Staff?</h3>
              <p className="text-slate-500 font-medium">This will remove their terminal permissions.</p>
              <div className="flex gap-4">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
                <button onClick={handleDeleteStaff} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-200">Remove</button>
              </div>
           </div>
        </div>
      )}

      {isShareModalOpen && staffToShare && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in text-center p-10 space-y-8">
             <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Staff Invite</h3>
                <p className="text-sm text-slate-500 font-medium">Invite {staffToShare.name} to join your shop.</p>
             </div>
             
             {shareQRCode && (
               <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 inline-block shadow-inner relative group">
                  <img src={shareQRCode} alt="Invite QR" className="w-48 h-48 mx-auto mix-blend-multiply" />
                  <div className="absolute inset-0 bg-white/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.5rem]">
                    <Share2 size={32} className="text-slate-900" />
                  </div>
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
                  className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-3"
               >
                 <Share2 size={24} /> Send WhatsApp Invite
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
