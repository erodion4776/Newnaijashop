
import React, { useState, useRef } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { Product, View } from '../types';
import Tesseract from 'tesseract.js';
import { processHandwrittenLedger } from '../services/geminiService';

interface InventoryProps {
  setView?: (view: View) => void;
}

const Inventory: React.FC<InventoryProps> = ({ setView }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState<number>(0);
  
  // OCR & Camera States
  const [isScanningExpiry, setIsScanningExpiry] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [migrationData, setMigrationData] = useState<Product[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const products = useLiveQuery(() => 
    db.products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).toArray()
  , [searchTerm]) || [];

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
    try {
      if (editingProduct?.id) {
        await db.products.update(editingProduct.id, {
          ...formData,
          price: Number(formData.price),
          cost_price: Number(formData.cost_price),
          stock_qty: Number(formData.stock_qty)
        });
      } else {
        // Fix: Explicitly use the transaction method on the db instance.
        await db.transaction('rw', [db.products, db.inventory_logs], async () => {
          const newId = await db.products.add({
            ...formData,
            price: Number(formData.price),
            cost_price: Number(formData.cost_price),
            stock_qty: Number(formData.stock_qty)
          });

          // Case A: Create 'Initial Stock' log entry
          await db.inventory_logs.add({
            product_id: newId as number,
            product_name: formData.name,
            quantity_changed: Number(formData.stock_qty),
            old_stock: 0,
            new_stock: Number(formData.stock_qty),
            type: 'Initial Stock',
            timestamp: Date.now(),
            performed_by: 'Admin'
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
    if (!restockProduct || !restockProduct.id) return;

    try {
      const oldStock = Number(restockProduct.stock_qty);
      const change = Number(restockQty);
      const newStock = oldStock + change;
      
      // Fix: Use inherited transaction method from Dexie to ensure atomic updates of stock levels and audit logs.
      await db.transaction('rw', [db.products, db.inventory_logs], async () => {
        // Update Product Table
        await db.products.update(restockProduct.id!, {
          stock_qty: newStock
        });

        // Case B: Create 'Restock' log entry
        await db.inventory_logs.add({
          product_id: restockProduct.id!,
          product_name: restockProduct.name,
          quantity_changed: change,
          old_stock: oldStock,
          new_stock: newStock,
          type: change >= 0 ? 'Restock' : 'Adjustment',
          timestamp: Date.now(),
          performed_by: 'Admin'
        });
      });

      setIsRestockModalOpen(false);
      setRestockProduct(null);
      setRestockQty(0);
    } catch (err) {
      alert("Restock failed: " + err);
    }
  };

  const startCamera = async () => {
    setIsScanningExpiry(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Camera error: " + err);
      setIsScanningExpiry(false);
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
    setIsScanningExpiry(false);
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const context = canvasRef.current.getContext('2d');
    context?.drawImage(videoRef.current, 0, 0, 400, 300);
    const dataUrl = canvasRef.current.toDataURL('image/jpeg');
    
    setIsProcessingAI(true);
    try {
      const { data: { text } } = await Tesseract.recognize(dataUrl, 'eng');
      const dateRegex = /(\d{4}-\d{2}-\d{2})|(\d{2}\/\d{2}\/\d{4})/;
      const match = text.match(dateRegex);
      if (match) {
        setFormData(prev => ({ ...prev, expiry_date: match[0] }));
        stopCamera();
      } else {
        alert("Could not find a clear date. Please try again.");
      }
    } catch (err) {
      console.error(err);
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
      const base64 = reader.result as string;
      const detectedProducts = await processHandwrittenLedger(base64);
      if (detectedProducts) {
        setMigrationData(detectedProducts);
      } else {
        alert("AI could not extract data. Try a clearer photo.");
      }
      setIsProcessingAI(false);
    };
    reader.readAsDataURL(file);
  };

  // Fix: Removed unused parameter 'p' to match call site and avoid shadowing loop variable.
  const importMigrationData = async () => {
    for (const p of migrationData) {
      await db.products.add(p);
    }
    setMigrationData([]);
    setIsMigrationModalOpen(false);
    alert("Ledger data imported successfully!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search inventory..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl outline-none shadow-sm focus:ring-2 focus:ring-emerald-500 font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
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
        </div>
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
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Pricing</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Inventory</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div>
                      <p className="font-bold text-slate-800">{product.name}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">SN: {product.barcode || '---'}</span>
                        {product.expiry_date && (
                          <span className={`text-[10px] font-black uppercase ${new Date(product.expiry_date) < new Date() ? 'text-rose-500' : 'text-emerald-500'}`}>
                            Exp: {product.expiry_date}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="inline-block px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <p className="font-black text-slate-900">₦{product.price.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Profit: ₦{(product.price - product.cost_price).toLocaleString()}</p>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-black ${product.stock_qty <= 10 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {product.stock_qty} Units
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setRestockProduct(product); setIsRestockModalOpen(true); }} 
                        className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-1.5 px-3"
                        title="Restock Item"
                      >
                        <PackagePlus size={16} />
                        <span className="text-[10px] font-black uppercase">Restock</span>
                      </button>
                      <button onClick={() => { setEditingProduct(product); setFormData(product); setIsModalOpen(true); }} className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 shadow-sm transition-all">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => { if(confirm("Delete product?")) db.products.delete(product.id!) }} className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-rose-50 hover:text-rose-600 shadow-sm transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-800">
                {editingProduct ? 'Update Inventory' : 'Add to Catalog'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Product Name</label>
                  <input required type="text" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Cost Price (₦)</label>
                    <input required type="number" step="any" min="0" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black" value={formData.cost_price} onChange={(e) => setFormData({...formData, cost_price: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">{editingProduct ? 'Current Stock Level' : 'Initial Stock Level'}</label>
                    <input required type="number" min="0" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black" value={formData.stock_qty} onChange={(e) => setFormData({...formData, stock_qty: Number(e.target.value)})} />
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Selling Price (₦)</label>
                    <input required type="number" step="any" min="0" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black" value={formData.price} onChange={(e) => setFormData({...formData, price: Number(e.target.value)})} />
                  </div>
                  <div className="relative">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Expiry Date</label>
                    <div className="relative">
                      <input type="text" placeholder="YYYY-MM-DD" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={formData.expiry_date} onChange={(e) => setFormData({...formData, expiry_date: e.target.value})} />
                      <button type="button" onClick={startCamera} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all">
                        <Camera size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-8 py-5 rounded-2xl font-black text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all">Discard</button>
                <button type="submit" className="flex-[2] px-8 py-5 rounded-2xl font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/30">
                  {editingProduct ? 'Commit Changes' : 'Register Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {isRestockModalOpen && restockProduct && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
           <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-emerald-50/30">
                 <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-600 text-white rounded-2xl">
                       <PackagePlus size={20} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Post Stock Inward</h3>
                 </div>
                 <button onClick={() => setIsRestockModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X size={20} />
                 </button>
              </div>
              <div className="p-8 space-y-8">
                 <div className="text-center space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Item</p>
                    <h4 className="text-2xl font-black text-slate-900">{restockProduct.name}</h4>
                    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500">
                       Current Inventory: <span className="text-slate-900 font-black">{restockProduct.stock_qty}</span>
                    </div>
                 </div>

                 <form onSubmit={handleRestockSubmit} className="space-y-6">
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Quantity Received</label>
                       <input 
                         required 
                         autoFocus
                         type="number" 
                         className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] outline-none focus:ring-2 focus:ring-emerald-500 font-black text-3xl text-center" 
                         placeholder="0"
                         value={restockQty} 
                         onChange={(e) => setRestockQty(Number(e.target.value))} 
                       />
                       <p className="text-center text-[10px] text-slate-400 font-bold uppercase mt-3 tracking-widest">
                          New Level will be <span className="text-emerald-600 font-black">{Number(restockProduct.stock_qty) + Number(restockQty)}</span> Units
                       </p>
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
                         className="flex-[2] py-4 rounded-2xl font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20"
                       >
                         Confirm Entry
                       </button>
                    </div>
                 </form>
              </div>
           </div>
        </div>
      )}

      {/* AI Ledger Migration Modal */}
      {isMigrationModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl">
          <div className="bg-white rounded-[3rem] w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-600 text-white rounded-2xl">
                  <Sparkles size={24} />
                </div>
                <h3 className="text-2xl font-black text-slate-900">Handwritten Ledger AI Migration</h3>
              </div>
              <button onClick={() => { setIsMigrationModalOpen(false); setMigrationData([]); }} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={24} />
              </button>
            </div>

            <div className="p-8">
              {isProcessingAI ? (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="relative">
                    <Loader2 size={80} className="animate-spin text-emerald-600" />
                    <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-400" size={32} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-800">AI Digitizing Ledger...</h4>
                    <p className="text-slate-400 mt-2">Gemini Flash is parsing handwriting and converting currencies.</p>
                  </div>
                </div>
              ) : migrationData.length > 0 ? (
                <div className="space-y-6">
                  <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex items-center gap-4">
                    <CheckCircle2 size={32} className="text-emerald-600" />
                    <div>
                      <p className="font-black text-emerald-900">AI Processing Complete</p>
                      <p className="text-emerald-700 text-sm">{migrationData.length} items detected. Please review before importing.</p>
                    </div>
                  </div>
                  
                  <div className="max-h-[40vh] overflow-y-auto rounded-2xl border border-slate-100 divide-y divide-slate-100">
                    {migrationData.map((item, i) => (
                      <div key={i} className="p-4 flex items-center justify-between bg-slate-50/50">
                        <div className="flex-1">
                          <input className="font-bold bg-transparent border-none outline-none w-full" value={item.name} onChange={e => {
                            const newData = [...migrationData];
                            newData[i].name = e.target.value;
                            setMigrationData(newData);
                          }} />
                          <p className="text-[10px] text-slate-400 font-black uppercase">Category: {item.category}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs font-black">₦{item.price.toLocaleString()}</p>
                            <p className="text-[10px] text-slate-400">Qty: {item.stock_qty}</p>
                          </div>
                          <button onClick={() => setMigrationData(prev => prev.filter((_, idx) => idx !== i))} className="text-rose-400 hover:text-rose-600 p-2">
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button onClick={() => setMigrationData([])} className="flex-1 py-5 bg-slate-100 rounded-2xl font-black text-slate-500 hover:bg-slate-200">Re-scan Photo</button>
                    <button onClick={() => importMigrationData()} className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl font-black text-xl shadow-xl shadow-emerald-200 transition-all hover:bg-emerald-700">Finalize & Import All</button>
                  </div>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center">
                  <div className="w-full max-w-sm aspect-video border-4 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center relative overflow-hidden group hover:border-emerald-300 transition-all cursor-pointer">
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleLedgerUpload} />
                    <UploadCloud size={64} className="text-slate-200 mb-4 group-hover:text-emerald-300 transition-colors" />
                    <p className="text-slate-400 font-bold">Snap or Upload Ledger Page</p>
                    <p className="text-[10px] text-slate-300 uppercase tracking-widest mt-2">Maximum clarity improves AI results</p>
                  </div>
                  
                  <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                    <div className="bg-slate-50 p-6 rounded-3xl space-y-2">
                       <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-black text-slate-800">1</div>
                       <p className="font-bold text-sm">Write clearly on a plain background.</p>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-3xl space-y-2">
                       <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-black text-slate-800">2</div>
                       <p className="font-bold text-sm">Include Name, Cost, Price, and Qty.</p>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-3xl space-y-2">
                       <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-black text-slate-800">3</div>
                       <p className="font-bold text-sm">AI handles 5k/10k price formats.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Camera Modal for Expiry Scan */}
      {isScanningExpiry && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-black rounded-[3rem] w-full max-md shadow-2xl overflow-hidden relative">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
               <div className="w-64 h-24 border-2 border-emerald-500 rounded-2xl relative shadow-[0_0_100px_rgba(16,185,129,0.3)]">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Align Date Label Here
                  </div>
               </div>
            </div>

            <div className="absolute bottom-10 inset-x-0 flex items-center justify-center gap-6">
              <button onClick={stopCamera} className="p-4 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30">
                <X size={24} />
              </button>
              <button onClick={captureAndScan} disabled={isProcessingAI} className="w-20 h-20 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-2xl border-4 border-white active:scale-95 disabled:opacity-50">
                {isProcessingAI ? <Loader2 className="animate-spin" /> : <Camera size={32} />}
              </button>
              <div className="w-12 h-12" /> {/* Spacer */}
            </div>
            
            <canvas ref={canvasRef} width="400" height="300" className="hidden" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
