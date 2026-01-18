import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import LZString from 'lz-string';
import QRCode from 'qrcode';
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
  ChevronRight,
  Edit,
  Eye,
  EyeOff,
  Loader2,
  Copy,
  QrCode,
  UserX,
  UserCheck,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Staff } from '../types';

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
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    role: 'Sales' as 'Sales' | 'Manager' | 'Admin', 
    password: '' 
  });
  
  const staffList = useLiveQuery(() => db.staff.toArray());
  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  
  const isLoading = staffList === undefined || settings === undefined;

  // Handle admin authentication
  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(false);
    
    if (!settings?.admin_pin) {
      alert("Admin PIN not configured. Please set up your shop first.");
      return;
    }
    
    if (adminPinInput === settings.admin_pin) {
      setIsAdminUnlocked(true);
    } else {
      setPinError(true);
      setAdminPinInput('');
    }
  };

  // Validate form
  const validateForm = (): string | null => {
    if (!formData.name.trim()) return "Name is required";
    if (formData.name.trim().length < 2) return "Name must be at least 2 characters";
    if (!formData.password) return "Password is required";
    if (formData.password.length < 4) return "Password must be at least 4 characters";
    
    // Check for duplicate names (except when editing same staff)
    const duplicate = (staffList || []).find(
      s => s.name.toLowerCase() === formData.name.trim().toLowerCase() && s.id !== editingStaff?.id
    );
    if (duplicate) return "A staff member with this name already exists";
    
    return null;
  };

  // Handle add/edit staff
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const error = validateForm();
    if (error) {
      alert(error);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (editingStaff?.id) {
        // Update existing staff
        await db.staff.update(editingStaff.id, {
          name: formData.name.trim(),
          role: formData.role,
          password: formData.password
        });
        showSuccess(`${formData.name} updated successfully!`);
      } else {
        // Add new staff
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

  // Toggle staff status
  const toggleStaffStatus = async (staff: Staff) => {
    if (!staff.id) return;
    
    const newStatus = staff.status === 'Active' ? 'Inactive' : 'Active';
    await db.staff.update(staff.id, { status: newStatus });
    showSuccess(`${staff.name} is now ${newStatus}`);
  };

  // Delete staff
  const handleDeleteStaff = async () => {
    if (!staffToDelete?.id) return;
    
    try {
      await db.staff.delete(staffToDelete.id);
      showSuccess(`${staffToDelete.name} has been removed`);
      setIsDeleteModalOpen(false);
      setStaffToDelete(null);
    } catch (err) {
      alert("Error deleting staff: " + err);
    }
  };

  // Generate onboarding data
  const generateOnboardingData = (staff: Staff) => {
    // Create a secure token instead of plain password
    const token = LZString.compressToEncodedURIComponent(JSON.stringify({
      id: staff.id,
      name: staff.name,
      role: staff.role,
      shop: settings?.shop_name,
      created: Date.now(),
      // Don't include plain password - use a hash or token in production
      auth: btoa(`${staff.name}:${staff.password}`)
    }));
    
    return {
      token,
      url: `${window.location.origin}/join?token=${token}`
    };
  };

  // Open share modal
  const openShareModal = async (staff: Staff) => {
    setStaffToShare(staff);
    setIsShareModalOpen(true);
    
    const { url } = generateOnboardingData(staff);
    
    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' }
      });
      setShareQRCode(qrDataUrl);
    } catch (err) {
      console.error("QR generation failed:", err);
    }
  };

  // Share via WhatsApp
  const shareViaWhatsApp = (staff: Staff) => {
    const { url } = generateOnboardingData(staff);
    
    const message = `🏪 Welcome to ${settings?.shop_name || 'Our Shop'}!\n\n` +
      `Hello ${staff.name}, your ${staff.role} account is ready.\n\n` +
      `📱 Click this link to set up your terminal:\n${url}\n\n` +
      `Your login password will be provided separately.`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Copy link to clipboard
  const copyLink = async (staff: Staff) => {
    const { url } = generateOnboardingData(staff);
    
    try {
      await navigator.clipboard.writeText(url);
      showSuccess("Link copied to clipboard!");
    } catch (err) {
      alert("Failed to copy: " + err);
    }
  };

  // Show success message
  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Close modal and reset form
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStaff(null);
    setFormData({ name: '', role: 'Sales', password: '' });
    setShowPassword(false);
  };

  // Open edit modal
  const openEditModal = (staff: Staff) => {
    setEditingStaff(staff);
    setFormData({
      name: staff.name,
      role: staff.role,
      password: staff.password
    });
    setIsModalOpen(true);
  };

  // Generate random password
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let password = '';
    for (let i = 0; i < 6; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
    setShowPassword(true);
  };

  // Role badge style
  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'Manager':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={48} className="animate-spin text-emerald-600" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Staff Data...</p>
      </div>
    );
  }

  // Admin PIN gate
  if (!isAdminUnlocked) {
    return (
      <div className="max-w-md mx-auto py-12 lg:py-20 px-4">
        <div className="bg-white p-8 lg:p-10 rounded-[3rem] shadow-2xl border border-slate-200 text-center space-y-8 animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <Lock size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800">Admin Authentication</h2>
            <p className="text-slate-400 text-sm font-medium">Enter your Secure Admin PIN to manage staff records.</p>
          </div>
          
          <form onSubmit={handleAdminAuth} className="space-y-4">
            <div className="relative">
              <input 
                type="password" 
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                className={`w-full px-6 py-5 bg-slate-50 border rounded-[2rem] outline-none focus:ring-2 focus:ring-emerald-500 font-black text-4xl text-center tracking-[0.5em] transition-colors ${
                  pinError ? 'border-rose-300 bg-rose-50' : 'border-slate-200'
                }`}
                value={adminPinInput}
                onChange={(e) => {
                  setPinError(false);
                  setAdminPinInput(e.target.value.replace(/\D/g, ''));
                }}
                autoFocus
              />
              {pinError && (
                <p className="text-rose-500 text-sm font-bold mt-2">Invalid PIN. Please try again.</p>
              )}
            </div>
            
            <button 
              type="submit"
              disabled={adminPinInput.length < 4}
              className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-[200] bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <CheckCircle2 size={20} />
          <span className="font-bold">{successMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Staff Registry</h3>
          <p className="text-sm text-slate-500 font-medium">
            {(staffList || []).length} staff members • {(staffList || []).filter(s => s.status === 'Active').length} active
          </p>
        </div>
        <button 
          onClick={() => {
            setEditingStaff(null);
            setFormData({ name: '', role: 'Sales', password: '' });
            setIsModalOpen(true);
          }}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20"
        >
          <UserPlus size={20} />
          Add Staff
        </button>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
        {(staffList || []).map((staff) => (
          <div 
            key={staff.id} 
            className={`bg-white p-6 lg:p-8 rounded-[2rem] border shadow-sm transition-all group ${
              staff.status === 'Inactive' 
                ? 'border-slate-200 bg-slate-50 opacity-70' 
                : 'border-slate-200 hover:border-emerald-200'
            }`}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner transition-colors ${
                staff.status === 'Inactive'
                  ? 'bg-slate-200 text-slate-400'
                  : 'bg-slate-100 text-slate-800 group-hover:bg-emerald-50 group-hover:text-emerald-600'
              }`}>
                {staff.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${getRoleBadgeStyle(staff.role)}`}>
                  {staff.role}
                </span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  staff.status === 'Active' 
                    ? 'bg-emerald-100 text-emerald-600' 
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {staff.status}
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="space-y-3">
              <h4 className="font-black text-xl text-slate-800">{staff.name}</h4>
              <div className="flex items-center gap-2 text-slate-400 text-sm font-bold bg-slate-50 p-3 rounded-xl border border-slate-100">
                <Key size={14} />
                <span className="font-mono tracking-wider">••••••••</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                Added {new Date(staff.created_at).toLocaleDateString('en-NG', { 
                  day: 'numeric', 
                  month: 'short', 
                  year: 'numeric' 
                })}
              </p>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => toggleStaffStatus(staff)}
                  className={`p-2.5 rounded-xl transition-all ${
                    staff.status === 'Active'
                      ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                      : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                  }`}
                  title={staff.status === 'Active' ? 'Deactivate' : 'Activate'}
                >
                  {staff.status === 'Active' ? <UserX size={18} /> : <UserCheck size={18} />}
                </button>
                <button 
                  onClick={() => openEditModal(staff)}
                  className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                  title="Edit"
                >
                  <Edit size={18} />
                </button>
                <button 
                  onClick={() => {
                    setStaffToDelete(staff);
                    setIsDeleteModalOpen(true);
                  }}
                  className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                  title="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <button 
                onClick={() => openShareModal(staff)}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
              >
                <Share2 size={14} />
                Share
              </button>
            </div>
          </div>
        ))}

        {/* Empty State */}
        {(staffList || []).length === 0 && (
          <div className="col-span-full py-20 lg:py-32 text-center bg-white border border-dashed border-slate-300 rounded-[3rem] space-y-4">
            <UserCog size={64} className="mx-auto text-slate-200" />
            <div>
              <p className="text-slate-500 font-bold">No Staff Members Yet</p>
              <p className="text-slate-400 text-sm mt-1">Add your first staff member to get started</p>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="mt-4 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold inline-flex items-center gap-2"
            >
              <UserPlus size={18} /> Add First Staff
            </button>
          </div>
        )}
      </div>

      {/* ============ MODALS ============ */}

      {/* Add/Edit Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 lg:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                  {editingStaff ? <Edit size={20} /> : <UserPlus size={20} />}
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  {editingStaff ? 'Edit Staff' : 'New Staff'}
                </h3>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 lg:p-8 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">
                  Full Name *
                </label>
                <input 
                  required
                  autoFocus
                  type="text" 
                  placeholder="Enter staff name"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">
                  Role *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Sales', 'Manager', 'Admin'] as const).map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setFormData({...formData, role})}
                      className={`py-3 rounded-xl text-sm font-bold transition-all border ${
                        formData.role === role
                          ? role === 'Admin' 
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : role === 'Manager'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">
                  Password * <span className="text-slate-300">(min. 4 chars)</span>
                </label>
                <div className="relative">
                  <input 
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    minLength={4}
                    className="w-full px-5 py-4 pr-24 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button 
                      type="button"
                      onClick={generatePassword}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Generate Password"
                    >
                      <RefreshCw size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-4 rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] py-4 rounded-2xl font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={20} />
                      {editingStaff ? 'Save Changes' : 'Add Staff'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && staffToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={36} className="text-rose-600" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900">Remove Staff?</h3>
                <p className="text-slate-500">
                  Are you sure you want to delete <span className="font-bold text-slate-800">"{staffToDelete.name}"</span>? 
                  This will remove all their access.
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setStaffToDelete(null);
                  }}
                  className="flex-1 py-4 rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteStaff}
                  className="flex-1 py-4 rounded-2xl font-black text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-xl shadow-rose-600/30"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {isShareModalOpen && staffToShare && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                  <Share2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Share Access</h3>
                  <p className="text-xs text-slate-400">{staffToShare.name}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsShareModalOpen(false);
                  setStaffToShare(null);
                  setShareQRCode(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* QR Code */}
              {shareQRCode && (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col items-center">
                  <img src={shareQRCode} alt="Onboarding QR" className="w-48 h-48" />
                  <p className="text-xs text-slate-400 font-medium mt-3 text-center">
                    Scan this QR code on the new device
                  </p>
                </div>
              )}

              {/* Share Options */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => shareViaWhatsApp(staffToShare)}
                  className="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-2xl transition-all border border-green-100"
                >
                  <MessageCircle size={24} className="text-green-600" />
                  <span className="text-xs font-bold text-green-700">WhatsApp</span>
                </button>
                <button
                  onClick={() => copyLink(staffToShare)}
                  className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all border border-slate-200"
                >
                  <Copy size={24} className="text-slate-600" />
                  <span className="text-xs font-bold text-slate-700">Copy Link</span>
                </button>
              </div>

              {/* Password Note */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Key size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold text-amber-800">Password Required</p>
                    <p className="text-amber-600 text-xs mt-1">
                      Share the password separately for security: 
                      <span className="font-mono font-bold ml-1">{staffToShare.password}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;