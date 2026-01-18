
import React, { useState, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  PackagePlus, 
  Sparkles, 
  Camera, 
  UploadCloud, 
  Loader2, 
  X, 
  CheckCircle2, 
  ClipboardList,
  AlertCircle,
  PackageCheck,
  RefreshCw,
  Info,
  Package,
  Minus,
  FileImage,
  Save,
  Trash
} from 'lucide-react';
import { Product, View, Staff } from '../types';
import Tesseract from 'tesseract.js';
import { processHandwrittenLedger } from '../services/geminiService';

interface InventoryProps {
  setView?: (view: View) => void;
  currentUser?: Staff | null;
}

const CATEGORIES = ['General', 'Electronics', 'Food & Drinks', 'Clothing', 'Health', 'Beauty', 'Home', 'Office', 'Other'];

const Inventory: React.FC<InventoryProps> = ({ setView, currentUser }) => {
  const isSales = currentUser?.role === 'Sales';
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState<number>(0);
  const [restockType, setRestockType] = useState<'add' | 'remove' | 'set'>('add');
  
  // OCR & Camera States
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [migrationData, setMigrationData] = useState<Product[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch all products
  const allProductsData = useLiveQuery(() => db.products.toArray());
  const isLoading = allProductsData === undefined;
  const allProducts = allProductsData || [];

  // Filter products based on search
  const products = useMemo(() => {
    if (!searchTerm.trim()) return allProducts;
    const term = searchTerm.toLowerCase();
    return allProducts.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.category?.toLowerCase().includes(term) ||
      p.barcode?.includes(term)
    );
  }, [allProducts, searchTerm]);

  const initialFormState: Product = {
    name: '',
    price: 0,
    cost_price: 0,
    stock_qty: 0,
    category: 'General',
    barcode: '',
    expiry_date: ''
  };

  const [formData, setFormData] = useState<Product>(initialFormState);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    try {
      if (editingProduct?.id) {
        const oldProduct = await db.products.get(editingProduct.id);
        const oldStock = oldProduct?.stock_qty || 0;
        const newStock = Number(formData.stock_qty);
        
        await db.products.update(editingProduct.id, {
          ...formData,
          price: Number(formData.price),
          cost_price: Number(formData.cost_price),
          stock_qty: newStock
        });

        if (oldStock !== newStock) {
          await db.inventory_logs.add({
            product_id: editingProduct.id,
            product_name: formData.name,
            quantity_changed: newStock - oldStock,
            old_stock: oldStock,
            new_stock: newStock,
            type: 'Adjustment',
            timestamp: Date.now(),
            performed_by: currentUser?.name || 'Admin'
          });
        }
      } else {
        await (db as any).transaction('rw', [db.products, db.inventory_logs], async () => {
          const newId = await db.products.add({
            ...formData,
            price: Number(formData.price),
            cost_price: Number(formData.cost_price),
            stock_qty: Number(formData.stock_qty)
          });

          await db.inventory_logs.add({
            product_id: newId as number,
            product_name: formData.name,
            quantity_changed: Number(formData.stock_qty),
            old_stock: 0,
            new_stock: Number(formData.stock_qty),
            type: 'Initial Stock',
            timestamp: Date.now(),
            performed_by: currentUser?.name || 'Admin'
          });
        });
      }
      
      setIsModalOpen(false);
      setFormData(initialFormState);
      setEditingProduct(null);
    } catch (err) {
      alert("Error saving product: " + err);
    }
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProduct || !restockProduct.id || !isAdmin) return;

    try {
      const oldStock = Number(restockProduct.stock_qty);
      let newStock: number;
      let change: number;

      switch (restockType) {
        case 'add':
          change = Math.abs(Number(restockQty));
          newStock = oldStock + change;
          break;
        case 'remove':
          change = -Math.abs(Number(restockQty));
          newStock = Math.max(0, oldStock + change);
          change = newStock - oldStock; 
          break;
        case 'set':
          newStock = Math.max(0, Number(restockQty));
          change = newStock - oldStock;
          break;
        default:
          return;
      }

      if (change === 0 && restockType !== 'set') {
        alert("No change in stock quantity.");
        return;
      }

      await (db as any).transaction('rw', [db.products, db.inventory_logs], async () => {
        await db.products.update(restockProduct.id!, {
          stock_qty: newStock
        });

        await db.inventory_logs.add({
          product_id: restockProduct.id!,
          product_name: restockProduct.name,
          quantity_changed: change,
          old_stock: oldStock,
          new_stock: newStock,
          type: change >= 0 ? 'Restock' : 'Adjustment',
          timestamp: Date.now(),
          performed_by: currentUser?.name || 'Admin'
        });
      });

      setIsRestockModalOpen(false);
      setRestockProduct(null);
      setRestockQty(0);
      setRestockType('add');
    } catch (err) {
      alert("Restock failed: " + err);
    }
  };

  const handleDelete = async () => {
    if (!deleteProduct?.id || !isAdmin) return;
    try {
      await db.products.delete(deleteProduct.id);
      setIsDeleteModalOpen(false);
      setDeleteProduct(null);
    } catch (err) {
      alert("Delete failed: " + err);
    }
  };

  const startCamera = async () => {
    setIsCameraModalOpen(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setCameraError("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraModalOpen(false);
    setCameraError(null);
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    setIsProcessingAI(true);
    try {
      const { data: { text } } = await Tesseract.recognize(dataUrl, 'eng');
      const datePatterns = [
        /(\d{4}[-\/]\d{2}[-\/]\d{2})/,
        /(\d{2}[-\/]\d{2}[-\/]\d{4})/,
        /(\d{2}[-\/]\d{2}[-\/]\d{2})/,
        /(EXP?:?\s*\d{2}[-\/]\d{2}[-\/]\d{2,4})/i,
        /(\d{2}[-\/]\d{4})/,
      ];
      
      let foundDate: string | null = null;
      for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
          foundDate = match[1].replace(/EXP?:?\s*/i, '').trim();
          break;
        }
      }
      
      if (foundDate) {
        setFormData(prev => ({ ...prev, expiry_date: foundDate! }));
        stopCamera();
      } else {
        setCameraError("Could not detect a date. Try moving closer.");
      }
    } catch (err) {
      setCameraError("Failed to process image.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleLedgerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setIsProcessingAI(true);
      try {
        const base64 = reader.result as string;
        const detectedProducts = await processHandwrittenLedger(base64);
        if (detectedProducts && detectedProducts.length > 0) {
          setMigrationData(detectedProducts);
        } else {
          alert("AI could not extract any products. Try a clearer photo.");
        }
      } catch (err) {
        alert("AI processing failed: " + err);
      } finally {
        setIsProcessingAI(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const importMigrationData = async () => {
    if (migrationData.length === 0) return;
    try {
      for (const product of migrationData) {
        await (db as any).transaction('rw', [db.products, db.inventory_logs], async () => {
          const newId = await db.products.add({
            ...product,
            price: Number(product.price) || 0,
            cost_price: Number(product.cost_price) || 0,
            stock_qty: Number(product.stock_qty) || 0,
            category: product.category || 'General'
          });

          await db.inventory_logs.add({
            product_id: newId as number,
            product_name: product.name,
            quantity_changed: Number(product.stock_qty) || 0,
            old_stock: 0,
            new_stock: Number(product.stock_qty) || 0,
            type: 'Restock',
            timestamp: Date.now(),
            performed_by: currentUser?.name || 'Admin (AI Import)'
          });
        });
      }
      setMigrationData([]);
      setIsMigrationModalOpen(false);
      alert(`Imported ${migrationData.length} products!`);
    } catch (err) {
      alert("Import failed: " + err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 size={48} className="animate-spin text-emerald-600 mb-4" />
        <p className="text-slate-500 font-medium font-black uppercase tracking-widest text-xs">Accessing Vault...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search products..." 
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-2xl outline-none shadow-sm focus:ring-2 focus:ring-emerald-500 font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>}
          </div>
          {isAdmin && (
            <>
              <button onClick={() => setIsMigrationModalOpen(true)} className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-100 transition-all shadow-sm">
                <Sparkles size={18} /> AI Import
              </button>
              <button onClick={() => setView && setView('inventory-ledger')} className="flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                <ClipboardList size={18} className="text-emerald-600" /> Audit Ledger
              </button>
            </>
          )}
        </div>
        {isAdmin && (
          <button onClick={() => { setEditingProduct(null); setFormData(initialFormState); setIsModalOpen(true); }} className="w-full xl:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl">
            <Plus size={20} /> Add Product
          </button>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden min-h-[400px] flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Details</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Price</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Stock</th>
                {isAdmin && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div>
                      <p className="font-bold text-slate-800">{product.name}</p>
                      {!isSales && (
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{product.barcode || 'NO SN'}</span>
                          {product.expiry_date && <span className={`text-[10px] font-black uppercase ${new Date(product.expiry_date) < new Date() ? 'text-rose-500' : 'text-emerald-500'}`}>EXP: {product.expiry_date}</span>}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5"><span className="inline-block px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black uppercase">{product.category}</span></td>
                  <td className="px-8 py-5 text-right"><p className="font-black text-slate-900">₦{product.price.toLocaleString()}</p></td>
                  <td className="px-8 py-5 text-right">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${product.stock_qty === 0 ? 'bg-rose-100 text-rose-600' : product.stock_qty <= 10 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {product.stock_qty} Units
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setRestockProduct(product); setRestockQty(0); setRestockType('add'); setIsRestockModalOpen(true); }} className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-1.5 px-3"><PackagePlus size={16} /><span className="text-[10px] font-black uppercase">Restock</span></button>
                        <button onClick={() => { setEditingProduct(product); setFormData(product); setIsModalOpen(true); }} className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-all"><Edit size={16} /></button>
                        <button onClick={() => { setDeleteProduct(product); setIsDeleteModalOpen(true); }} className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-rose-50 hover:text-rose-600 shadow-sm transition-all"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {allProducts.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 px-6 text-center">
             <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4"><PackageCheck size={40} className="text-slate-200" /></div>
             <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Stock Inventory Empty</p>
             <button onClick={() => setIsModalOpen(true)} className="mt-4 px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest">Register First Product</button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* MODALS */}
      {isAdmin && isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 my-8">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-800">{editingProduct ? 'Update Item' : 'New Catalog Entry'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Product Title</label>
                  <input required type="text" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Category</label>
                  <select className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>{CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Cost Price (₦)</label>
                  <input required type="number" step="any" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black" value={formData.cost_price || ''} onChange={(e) => setFormData({...formData, cost_price: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Selling Price (₦)</label>
                  <input required type="number" step="any" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black" value={formData.price || ''} onChange={(e) => setFormData({...formData, price: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Initial Stock</label>
                  <input required type="number" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black" value={formData.stock_qty || ''} onChange={(e) => setFormData({...formData, stock_qty: Number(e.target.value)})} />
                </div>
                <div className="md:col-span-2 relative">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Expiry Date</label>
                  <div className="relative">
                    <input type="date" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={formData.expiry_date} onChange={(e) => setFormData({...formData, expiry_date: e.target.value})} />
                    <button type="button" onClick={startCamera} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"><Camera size={18} /></button>
                  </div>
                </div>
              </div>
              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-8 py-5 rounded-2xl font-black text-slate-500 bg-slate-100 uppercase text-xs tracking-widest">Cancel</button>
                <button type="submit" className="flex-[2] px-8 py-5 rounded-2xl font-black text-white bg-emerald-600 shadow-xl uppercase text-sm tracking-widest flex items-center justify-center gap-2"><Save size={20} />{editingProduct ? 'Update Entry' : 'Add to Stock'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdmin && isRestockModalOpen && restockProduct && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-emerald-50/30">
               <h3 className="text-xl font-black text-slate-800 tracking-tight">Post Inventory Change</h3>
               <button onClick={() => setIsRestockModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adjusting Item</p>
                <h4 className="text-2xl font-black text-slate-900">{restockProduct.name}</h4>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['add', 'remove', 'set'].map(t => (
                  <button key={t} onClick={() => setRestockType(t as any)} className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${restockType === t ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>{t}</button>
                ))}
              </div>
              <form onSubmit={handleRestockSubmit} className="space-y-6">
                <input required autoFocus type="number" className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] outline-none focus:ring-2 focus:ring-emerald-500 font-black text-4xl text-center" value={restockQty || ''} onChange={(e) => setRestockQty(Number(e.target.value))} />
                <button type="submit" className={`w-full py-5 rounded-2xl font-black text-white shadow-xl flex items-center justify-center gap-2 ${restockType === 'remove' ? 'bg-rose-600' : 'bg-emerald-600'}`}><CheckCircle2 size={20} />Confirm Adjustment</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {isAdmin && isDeleteModalOpen && deleteProduct && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-8 text-center space-y-6 animate-in zoom-in">
            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><Trash2 size={40} /></div>
            <div>
               <h3 className="text-xl font-black text-slate-900 tracking-tight">Delete Product?</h3>
               <p className="text-slate-500 text-sm mt-2">This will permanently remove <b>{deleteProduct.name}</b> from the terminal catalog.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black text-xs uppercase tracking-widest rounded-2xl">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-4 bg-rose-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-rose-200">Delete Now</button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && isMigrationModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in my-8">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl"><Sparkles size={24} /></div>
                <div><h3 className="text-xl font-black text-slate-800">AI Ledger Import</h3><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Handwritten Record Scanning</p></div>
              </div>
              <button onClick={() => { setIsMigrationModalOpen(false); setMigrationData([]); }} className="p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-6">
              {migrationData.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center hover:border-emerald-400 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {isProcessingAI ? <div className="space-y-4"><Loader2 size={48} className="animate-spin text-emerald-600 mx-auto" /><p className="font-black text-xs uppercase tracking-widest text-slate-400">Gemini reading ledger...</p></div> : <div className="space-y-4"><div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto"><FileImage size={36} className="text-emerald-600" /></div><div><p className="font-black text-slate-700">Upload Ledger Photo</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">AI will extract products and prices</p></div></div>}
                </div>
              ) : (
                <div className="space-y-4">
                   <div className="flex items-center justify-between"><h4 className="font-black text-slate-800">Review {migrationData.length} Items</h4><button onClick={() => setMigrationData([])} className="text-rose-500 text-[10px] font-black uppercase">Reset</button></div>
                   <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">{migrationData.map((p, i) => <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200"><div className="min-w-0 flex-1"><p className="font-black text-slate-800 truncate">{p.name}</p><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Qty: {p.stock_qty} | Price: ₦{p.price}</p></div><button onClick={() => setMigrationData(migrationData.filter((_, idx) => idx !== i))} className="p-2 text-slate-300 hover:text-rose-500"><Trash size={16} /></button></div>)}</div>
                   <button onClick={importMigrationData} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3"><UploadCloud size={24} /> Import Verified List</button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleLedgerUpload} />
            </div>
          </div>
        </div>
      )}

      {isCameraModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800">Scan Expiry Date</h3>
              <button onClick={stopCamera} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {cameraError ? <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl flex items-center gap-3"><AlertCircle size={20} /><span className="text-sm font-medium">{cameraError}</span></div> : <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden relative"><video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />{isProcessingAI && <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center text-white"><Loader2 size={48} className="animate-spin mb-3" /></div>}</div>}
              <button onClick={captureAndScan} disabled={isProcessingAI} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"><Camera size={20} />{isProcessingAI ? 'Processing...' : 'Capture Date'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
