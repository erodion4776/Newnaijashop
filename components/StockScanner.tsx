
import React, { useState, useRef } from 'react';
import { Camera, X, Loader2, CheckCircle, Edit2, Plus, Trash2, Smartphone, Zap } from 'lucide-react';
import LocalVisionService, { ScannedProduct } from '../utils/LocalVisionService';

interface StockScannerProps {
  onConfirm: (products: ScannedProduct[]) => void;
  onClose: () => void;
}

const StockScanner: React.FC<StockScannerProps> = ({ onConfirm, onClose }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedProduct[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => setCapturedImage(ev.target?.result as string);
    reader.readAsDataURL(file);

    setIsProcessing(true);
    try {
      const results = await LocalVisionService.processStockPhoto(file);
      setScannedItems(results);
    } catch (err) {
      alert("Local OCR Error: Ensure image is clear.");
    } finally {
      setIsProcessing(false);
    }
  };

  const updateItem = (index: number, field: keyof ScannedProduct, value: string | number) => {
    const updated = [...scannedItems];
    if (field === 'name') {
      updated[index].name = value as string;
    } else {
      updated[index][field] = Number(value);
    }
    setScannedItems(updated);
  };

  const removeItem = (index: number) => {
    setScannedItems(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Ledger Scanner</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Local AI (No Data Cost)</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-full text-slate-400"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          {!capturedImage ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-8 py-20">
              <div className="w-32 h-32 bg-emerald-50 text-emerald-600 rounded-[2.5rem] flex items-center justify-center shadow-inner animate-bounce-soft">
                <Camera size={64} />
              </div>
              <div className="space-y-4 max-w-sm">
                <h4 className="text-xl font-black text-slate-900">Scan Paper Notebook</h4>
                <p className="text-slate-500 font-medium">Place your notebook on a flat surface with good lighting. We'll use your phone's processor to read the text.</p>
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-10 py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-emerald-900/20 hover:bg-emerald-700 transition-all flex items-center gap-3 active:scale-95"
              >
                <Camera size={24} /> Snap Ledger Photo
              </button>
              <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />
            </div>
          ) : isProcessing ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-8 py-20">
              <div className="relative">
                <Loader2 size={80} className="text-emerald-600 animate-spin" />
                <Smartphone size={32} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-black text-slate-900">Scanning Handwriting...</h4>
                <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">On-Device Neural Engine Active</p>
                <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3 max-w-xs mx-auto">
                   <Zap size={16} className="text-amber-500" />
                   <p className="text-[10px] font-bold text-slate-500 text-left">This process stays on your phone. No internet data is used.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-bottom-4">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-1/3 aspect-[3/4] bg-slate-100 rounded-[2rem] overflow-hidden border-2 border-slate-100 shrink-0">
                   <img src={capturedImage} alt="Ledger" className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1 space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest flex items-center gap-2">
                      <CheckCircle size={14} className="text-emerald-500" /> 
                      Verify Detected Items ({scannedItems.length})
                    </h4>
                    <button onClick={() => setCapturedImage(null)} className="text-[10px] font-black text-rose-500 uppercase">Retake Photo</button>
                  </div>

                  <div className="space-y-3">
                    {scannedItems.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row gap-4 items-center">
                        <input 
                          type="text" 
                          className="flex-1 min-w-0 bg-white px-4 py-2 rounded-xl border border-slate-200 font-bold text-sm outline-none focus:border-emerald-500"
                          value={item.name}
                          onChange={(e) => updateItem(idx, 'name', e.target.value)}
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">₦</span>
                            <input 
                              type="number" 
                              className="w-24 bg-white pl-7 pr-3 py-2 rounded-xl border border-slate-200 font-black text-sm text-emerald-600 outline-none"
                              value={item.price}
                              onChange={(e) => updateItem(idx, 'price', e.target.value)}
                            />
                          </div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">QTY</span>
                            <input 
                              type="number" 
                              className="w-20 bg-white pl-9 pr-3 py-2 rounded-xl border border-slate-200 font-black text-sm outline-none"
                              value={item.stock_qty}
                              onChange={(e) => updateItem(idx, 'stock_qty', e.target.value)}
                            />
                          </div>
                          <button onClick={() => removeItem(idx)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 size={18}/></button>
                        </div>
                      </div>
                    ))}
                    
                    {scannedItems.length === 0 && (
                       <div className="py-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                          <p className="text-slate-400 font-bold text-sm">No items detected. Try again with a clearer photo.</p>
                       </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0">
          <button onClick={onClose} className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black uppercase text-xs">Cancel</button>
          <button 
            disabled={scannedItems.length === 0 || isProcessing}
            onClick={() => onConfirm(scannedItems)}
            className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-emerald-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Confirm & Add {scannedItems.length} Products
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockScanner;
