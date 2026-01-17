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
  Archive,
  ClipboardList,
  AlertCircle,
  PackageCheck,
  RefreshCw,
  Info,
  Package,
  Minus,
  FileImage,
  Eye,
  Trash,
  Save
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

  // Fetch all products first, then filter in useMemo
  const allProducts = useLiveQuery(() => db.products.toArray()) || [];
  const isLoading = allProducts === undefined;

  // Filter products based on search
  const products = useMemo(() => {
    if (!allProducts) return [];
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

        // Log stock change if quantity was modified
        if (oldStock !== newStock) {
          await db.inventory_logs.add({
            product_id: editingProduct.id,
            product_name: formData.name,
            quantity_changed: newStock - oldStock,
            old_stock: oldStock,
            new_stock: newStock,
            type: 'adjustment',
            timestamp: Date.now(),
            performed_by: currentUser?.name || 'Admin'
          });
        }
      } else {
        await db.transaction('rw', [db.products, db.inventory_logs], async () => {
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
            type: 'restock',
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
          change = newStock - oldStock; // Recalculate in case we hit 0
          break;
        case 'set':
          newStock = Math.max(0, Number(restockQty));
          change = newStock - oldStock;
          break;
        default:
          return;
      }

      if (change === 0) {
        alert("No change in stock quantity.");
        return;
      }

      await db.transaction('rw', [db.products, db.inventory_logs], async () => {
        await db.products.update(restockProduct.id!, {
          stock_qty: newStock
        });

        await db.inventory_logs.add({
          product_id: restockProduct.id!,
          product_name: restockProduct.name,
          quantity_changed: change,
          old_stock: oldStock,
          new_stock: newStock,
          type: change >= 0 ? 'restock' : 'adjustment',
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

  // Camera Functions
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
      console.error("Camera error:", err);
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
      
      // Common date formats
      const datePatterns = [
        /(\d{4}[-\/]\d{2}[-\/]\d{2})/, // YYYY-MM-DD or YYYY/MM/DD
        /(\d{2}[-\/]\d{2}[-\/]\d{4})/, // DD-MM-YYYY or DD/MM/YYYY
        /(\d{2}[-\/]\d{2}[-\/]\d{2})/, // DD-MM-YY or DD/MM/YY
        /(EXP?:?\s*\d{2}[-\/]\d{2}[-\/]\d{2,4})/i, // EXP: format
        /(\d{2}[-\/]\d{4})/, // MM/YYYY
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
        setCameraError("Could not detect a date. Try moving closer or improving lighting.");
      }
    } catch (err) {
      console.error("OCR Error:", err);
      setCameraError("Failed to process image. Please try again.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  // AI Ledger Import
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
          alert("AI could not extract any products. Try a clearer photo with visible product names and prices.");
        }
      } catch (err) {
        console.error("AI Processing Error:", err);
        alert("AI processing failed: " + err);
      } finally {
        setIsProcessingAI(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const updateMigrationItem = (index: number, field: keyof Product, value: any) => {
    setMigrationData(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const removeMigrationItem = (index: number) => {
    setMigrationData(prev => prev.filter((_, i) => i !== index));
  };

  const importMigrationData = async () => {
    if (migrationData.length === 0) return;
    
    try {
      for (const product of migrationData) {
        await db.transaction('rw', [db.products, db.inventory_logs], async () => {
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
            type: 'restock',
            timestamp: Date.now(),
            performed_by: currentUser?.name || 'Admin (AI Import)'
          });
        });
      }
      
      setMigrationData([]);
      setIsMigrationModalOpen(false);
      alert(`Successfully imported ${migrationData.length} products!`);
    } catch (err) {
      alert("Import failed: " + err);
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 size={48} className="animate-spin text-emerald-600 mb-4" />
        <p className="text-slate-500 font-medium">Loading inventory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search products, category, barcode..." 
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-2xl outline-none shadow-sm focus:ring-2 focus:ring-emerald-500 font-medium"
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
          {isAdmin && (
            <>
              <button 
                onClick={() => setIsMigrationModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-6 py-2.5 rounded-2xl font-bold hover:bg-emerald-100 transition-all shadow-sm"
              >
                <Sparkles size={18} />
                AI Import
              </button>
              <button 
                onClick={() => setView && setView('inventory-ledger')}
                className="flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-6 py-2.5 rounded-2xl font-bold hover:bg-slate-50 transition-all shadow-sm"
              >
                <ClipboardList size={18} className="text-emerald-600" />
                Inventory Ledger
              </button>
            </>
          )}
        </div>
        {isAdmin && (
          <button 
            onClick={() => {
              setEditingProduct(null);
              setFormData(initialFormState);
              setIsModalOpen(true);
            }}
            className="w-full xl:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-2.5 rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/10"
          >
            <Plus size={20} />
            Add Product
          </button>
        )}
      </div>

      {/* Search Results Info */}
      {searchTerm && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium">
          <Search size={16} />
          Found {products.length} of {allProducts.length} products matching "{searchTerm}"
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden min-h-[400px] flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Details</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Selling Price</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Availability</th>
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
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">
                            {product.barcode ? `SN: ${product.barcode}` : 'No Barcode'}
                          </span>
                          {product.expiry_date && (
                            <span className={`text-[10px] font-black uppercase ${
                              new Date(product.expiry_date) < new Date() 
                                ? 'text-rose-500' 
                                : new Date(product.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                                  ? 'text-amber-500'
                                  : 'text-emerald-500'
                            }`}>
                              Exp: {product.expiry_date}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="inline-block px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <p className="font-black text-slate-900">₦{product.price.toLocaleString()}</p>
                    {!isSales && (
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        Margin: ₦{(product.price - product.cost_price).toLocaleString()}
                      </p>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex flex-col items-end">
                      <span className={`px-4 py-1.5 rounded-full text-xs font-black ${
                        product.stock_qty === 0 
                          ? 'bg-rose-100 text-rose-600' 
                          : product.stock_qty <= 10 
                            ? 'bg-amber-50 text-amber-600' 
                            : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {product.stock_qty} Units
                      </span>
                      {product.stock_qty === 0 && (
                        <span className="text-[9px] font-black text-rose-500 uppercase mt-1">Out of Stock</span>
                      )}
                      {product.stock_qty > 0 && product.stock_qty <= 5 && (
                        <span className="text-[9px] font-black text-amber-500 uppercase mt-1">Low Stock</span>
                      )}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { 
                            setRestockProduct(product); 
                            setRestockQty(0);
                            setRestockType('add');
                            setIsRestockModalOpen(true); 
                          }} 
                          className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-1.5 px-3"
                          title="Restock Item"
                        >
                          <PackagePlus size={16} />
                          <span className="text-[10px] font-black uppercase">Restock</span>
                        </button>
                        <button 
                          onClick={() => { 
                            setEditingProduct(product); 
                            setFormData(product); 
                            setIsModalOpen(true); 
                          }} 
                          className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 shadow-sm transition-all"
                          title="Edit Product"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => { 
                            setDeleteProduct(product);
                            setIsDeleteModalOpen(true);
                          }} 
                          className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-rose-50 hover:text-rose-600 shadow-sm transition-all"
                          title="Delete Product"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Empty States */}
        {allProducts.length > 0 && products.length === 0 && searchTerm && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 px-6 text-center">
            <Search size={48} className="text-slate-200 mb-4" />
            <p className="text-slate-500 font-bold">No products match your search</p>
            <p className="text-slate-400 text-sm mt-1">Try different keywords</p>
            <button 
              onClick={() => setSearchTerm('')}
              className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm"
            >
              Clear Search
            </button>
          </div>
        )}

        {allProducts.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 px-6 text-center animate-in fade-in duration-500">
            {isSales ? (
              <div className="space-y-6 max-w-sm">
                <div className="w-24 h-24 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <RefreshCw size={48} className="opacity-60" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-black text-slate-800 tracking-tight">No inventory found</h4>
                  <p className="text-slate-500 text-sm font-medium">
                    Please sync with Admin to download the latest product list and prices.
                  </p>
                </div>
                {setView && (
                  <button 
                    onClick={() => setView('sync')}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    <RefreshCw size={20} />
                    Go to Sync Center
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto">
                  <PackageCheck size={40} className="text-slate-200" />
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Registry Empty</p>
                  <p className="text-slate-500 font-bold">Register your first product to start selling.</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingProduct(null);
                    setFormData(initialFormState);
                    setIsModalOpen(true);
                  }}
                  className="mt-4 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2"
                >
                  <Plus size={18} /> Add First Product
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden Canvas for OCR */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ===================== MODALS ===================== */}

      {/* Add/Edit Product Modal */}
      {isAdmin && isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 my-8">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-800">
                {editingProduct ? 'Update Inventory' : 'Add to Catalog'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Product Name */}
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                    Product Name *
                  </label>
                  <input 
                    required 
                    type="text" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" 
                    placeholder="Enter product name"
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  />
                </div>
                
                {/* Category */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                    Category
                  </label>
                  <select
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Barcode */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                    Barcode / SKU
                  </label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" 
                    placeholder="Optional"
                    value={formData.barcode} 
                    onChange={(e) => setFormData({...formData, barcode: e.target.value})} 
                  />
                </div>
                
                {/* Cost Price */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                    Cost Price (₦) *
                  </label>
                  <input 
                    required 
                    type="number" 
                    step="any" 
                    min="0" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black" 
                    placeholder="0"
                    value={formData.cost_price || ''} 
                    onChange={(e) => setFormData({...formData, cost_price: Number(e.target.value)})} 
                  />
                </div>

                {/* Selling Price */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                    Selling Price (₦) *
                  </label>
                  <input 
                    required 
                    type="number" 
                    step="any" 
                    min="0" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black" 
                    placeholder="0"
                    value={formData.price || ''} 
                    onChange={(e) => setFormData({...formData, price: Number(e.target.value)})} 
                  />
                </div>

                {/* Stock Quantity */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                    {editingProduct ? 'Current Stock Level' : 'Initial Stock Level'}
                  </label>
                  <input 
                    required 
                    type="number" 
                    min="0" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black" 
                    placeholder="0"
                    value={formData.stock_qty || ''} 
                    onChange={(e) => setFormData({...formData, stock_qty: Number(e.target.value)})} 
                  />
                </div>

                {/* Expiry Date */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                    Expiry Date
                  </label>
                  <div className="relative">
                    <input 
                      type="date" 
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" 
                      value={formData.expiry_date} 
                      onChange={(e) => setFormData({...formData, expiry_date: e.target.value})} 
                    />
                    <button 
                      type="button" 
                      onClick={startCamera} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"
                      title="Scan expiry date with camera"
                    >
                      <Camera size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Profit Preview */}
              {formData.price > 0 && formData.cost_price > 0 && (
                <div className="bg-emerald-50 rounded-2xl p-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-700">Profit per unit:</span>
                  <span className={`text-xl font-black ${
                    formData.price - formData.cost_price >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    ₦{(formData.price - formData.cost_price).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="pt-6 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 px-8 py-5 rounded-2xl font-black text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  className="flex-[2] px-8 py-5 rounded-2xl font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {editingProduct ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera Modal for OCR */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                  <Camera size={20} />
                </div>
                <h3 className="text-lg font-black text-slate-800">Scan Expiry Date</h3>
              </div>
              <button onClick={stopCamera} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {cameraError ? (
                <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl flex items-center gap-3">
                  <AlertCircle size={20} />
                  <span className="text-sm font-medium">{cameraError}</span>
                </div>
              ) : (
                <>
                  <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden relative">
                    <video 
                      ref={videoRef} 
                      className="w-full h-full object-cover" 
                      autoPlay 
                      playsInline 
                      muted 
                    />
                    {isProcessingAI && (
                      <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
                        <div className="text-center text-white">
                          <Loader2 size={48} className="animate-spin mx-auto mb-3" />
                          <p className="font-medium">Processing image...</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-sm text-slate-500 text-center">
                    Point camera at the expiry date on the product
                  </p>
                  
                  <button 
                    onClick={captureAndScan}
                    disabled={isProcessingAI}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Camera size={20} />
                    Capture & Scan
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {isAdmin && isRestockModalOpen && restockProduct && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-emerald-50/30">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-600 text-white rounded-2xl">
                  <PackagePlus size={20} />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Stock Adjustment</h3>
              </div>
              <button 
                onClick={() => setIsRestockModalOpen(false)} 
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              {/* Product Info */}
              <div className="text-center space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Item</p>
                <h4 className="text-2xl font-black text-slate-900">{restockProduct.name}</h4>
                <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500">
                  Current Stock: <span className="text-slate-900 font-black">{restockProduct.stock_qty}</span>
                </div>
              </div>

              {/* Adjustment Type */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRestockType('add')}
                  className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 transition-all ${
                    restockType === 'add' 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Plus size={16} /> Add
                </button>
                <button
                  type="button"
                  onClick={() => setRestockType('remove')}
                  className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 transition-all ${
                    restockType === 'remove' 
                      ? 'bg-rose-600 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Minus size={16} /> Remove
                </button>
                <button
                  type="button"
                  onClick={() => setRestockType('set')}
                  className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 transition-all ${
                    restockType === 'set' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Edit size={16} /> Set
                </button>
              </div>

              <form onSubmit={handleRestockSubmit} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                    {restockType === 'set' ? 'New Stock Quantity' : 'Quantity'}
                  </label>
                  <input 
                    required 
                    autoFocus
                    type="number" 
                    min="0"
                    className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] outline-none focus:ring-2 focus:ring-emerald-500 font-black text-3xl text-center" 
                    placeholder="0"
                    value={restockQty || ''} 
                    onChange={(e) => setRestockQty(Number(e.target.value))} 
                  />
                  
                  {/* Preview */}
                  <div className="mt-4 p-4 bg-slate-50 rounded-2xl">
                    <p className="text-center text-sm text-slate-500">
                      New stock level will be:{' '}
                      <span className={`text-xl font-black ${
                        restockType === 'remove' ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {restockType === 'add' 
                          ? Number(restockProduct.stock_qty) + Number(restockQty || 0)
                          : restockType === 'remove'
                            ? Math.max(0, Number(restockProduct.stock_qty) - Number(restockQty || 0))
                            : Number(restockQty || 0)
                        } Units
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsRestockModalOpen(false)} 
                    className="flex-1 py-4 rounded-2xl font-black text-slate-400 bg-slate-50 hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className={`flex-[2] py-4 rounded-2xl font-black text-white transition-all shadow-xl flex items-center justify-center gap-2 ${
                      restockType === 'remove' 
                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' 
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    }`}
                  >
                    <CheckCircle2 size={20} />
                    Confirm
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isAdmin && isDeleteModalOpen && deleteProduct && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={36} className="text-rose-600" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900">Delete Product?</h3>
                <p className="text-slate-500">
                  Are you sure you want to delete <span className="font-bold text-slate-800">"{deleteProduct.name}"</span>? This action cannot be undone.
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-4 rounded-2xl font-black text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 py-4 rounded-2xl font-black text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-xl shadow-rose-600/30"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Migration Modal */}
      {isAdmin && isMigrationModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in my-8">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">AI Ledger Import</h3>
                  <p className="text-xs text-slate-400">Upload a photo of your handwritten inventory</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsMigrationModalOpen(false);
                  setMigrationData([]);
                }}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              {migrationData.length === 0 ? (
                <>
                  {/* Upload Area */}
                  <div 
                    className="border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center hover:border-emerald-400 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isProcessingAI ? (
                      <div className="space-y-4">
                        <Loader2 size={48} className="animate-spin text-emerald-600 mx-auto" />
                        <div>
                          <p className="font-bold text-slate-700">AI is reading your ledger...</p>
                          <p className="text-sm text-slate-400">This may take a moment</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                          <FileImage size={36} className="text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-700">Click to upload ledger photo</p>
                          <p className="text-sm text-slate-400 mt-1">
                            Supports JPG, PNG - Clear photos work best
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleLedgerUpload}
                  />

                  {/* Tips */}
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                      <Info size={16} />
                      Tips for best results
                    </div>
                    <ul className="text-xs text-amber-600 space-y-1 pl-6">
                      <li>• Write product names clearly on each line</li>
                      <li>• Include price and quantity if available</li>
                      <li>• Use good lighting, avoid shadows</li>
                      <li>• Take photo straight-on, not at an angle</li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  {/* Review Detected Products */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-slate-800">Review Detected Products</h4>
                      <p className="text-sm text-slate-400">
                        {migrationData.length} products found - edit before importing
                      </p>
                    </div>
                    <button 
                      onClick={() => setMigrationData([])}
                      className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-rose-600"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {migrationData.map((product, index) => (
                      <div 
                        key={index} 
                        className="bg-slate-50 rounded-2xl p-4 border border-slate-200"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Name</label>
                              <input 
                                type="text"
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium"
                                value={product.name}
                                onChange={(e) => updateMigrationItem(index, 'name', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Price (₦)</label>
                              <input 
                                type="number"
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                                value={product.price || ''}
                                onChange={(e) => updateMigrationItem(index, 'price', Number(e.target.value))}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Stock</label>
                              <input 
                                type="number"
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                                value={product.stock_qty || ''}
                                onChange={(e) => updateMigrationItem(index, 'stock_qty', Number(e.target.value))}
                              />
                            </div>
                          </div>
                          <button 
                            onClick={() => removeMigrationItem(index)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                          >
                            <Trash size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Import Button */}
                  <button 
                    onClick={importMigrationData}
                    className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all"
                  >
                    <UploadCloud size={24} />
                    Import {migrationData.length} Products
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
