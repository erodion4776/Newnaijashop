
import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import LZString from 'lz-string';
import { useSync } from '../context/SyncProvider';
import { db } from '../db/db';
import { 
  Wifi, 
  Smartphone, 
  Loader2, 
  X,
  Camera,
  ArrowRightLeft,
  CheckCircle2,
  RefreshCw,
  Info,
  MessageSquare,
  ClipboardPaste,
  Share2,
  AlertCircle,
  Zap,
  Globe
} from 'lucide-react';
import { Staff, View, Sale } from '../types';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

interface SyncStationProps {
  currentUser?: Staff | null;
  setView: (view: View) => void;
}

const SyncStation: React.FC<SyncStationProps> = ({ currentUser, setView }) => {
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';
  const { status, initiateSync, resetConnection, broadcastInventory, sessionId, processWhatsAppSync } = useSync();
  
  const [mode, setMode] = useState<'idle' | 'host' | 'join'>('idle');
  const [step, setStep] = useState<'idle' | 'generating' | 'showing' | 'scanning' | 'whatsapp'>('idle');
  const [qrData, setQrData] = useState<string | null>(null);
  const [rawSignal, setRawSignal] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    resetConnection();
    setMode('idle');
    setStep('idle');
    setQrData(null);
    setRawSignal(null);
  }, [resetConnection]);

  const handleStartSync = async (isHost: boolean) => {
    cleanup();
    const activeMode = isHost ? 'host' : 'join';
    setMode(activeMode);
    setStep('generating');
    
    // NEW PEER INSTANCE CREATED WITH FRESH SESSION ID
    const p = initiateSync(isHost);

    p.on('signal', (data: any) => {
      // INCLUDE SESSION ID IN HANDSHAKE
      const payload = { 
        sessionId: sessionId,
        timestamp: Date.now(),
        signal: data 
      };
      const signalStr = JSON.stringify(payload);
      const compressed = LZString.compressToEncodedURIComponent(signalStr);
      setRawSignal(compressed);
      
      QRCode.toDataURL(compressed, { margin: 1, scale: 8 }, (err, url) => {
        if (!err) {
          setQrData(url);
          setStep('showing');
        }
      });
    });
  };

  const handleWhatsAppExport = async () => {
    try {
      setIsProcessing(true);
      const today = new Date().setHours(0,0,0,0);
      let dataToExport;

      if (isAdmin) {
        const products = await db.products.toArray();
        dataToExport = { type: 'WHATSAPP_EXPORT', products, timestamp: Date.now() };
      } else {
        const sales = await db.sales.where('timestamp').aboveOrEqual(today).toArray();
        dataToExport = { type: 'WHATSAPP_EXPORT', sales, timestamp: Date.now() };
      }

      const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(dataToExport));
      const message = `📦 NAIJASHOP SYNC DATA (${new Date().toLocaleDateString()}):\n\n${compressed}`;
      
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
      setIsProcessing(false);
    } catch (e) {
      alert("Export Failed: " + e);
      setIsProcessing(false);
    }
  };

  const handleWhatsAppImport = async () => {
    if (!manualInput.trim()) return;
    try {
      setIsProcessing(true);
      const results = await processWhatsAppSync(manualInput.trim());
      alert(`Import Successful!\n${results.sales} Sales Processed\n${results.products} Products Synced`);
      setManualInput('');
      setStep('idle');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (status === 'live' && isAdmin) {
      broadcastInventory();
      setTimeout(() => setView('dashboard'), 2000);
    } else if (status === 'live') {
      setTimeout(() => setView('dashboard'), 2000);
    }
  }, [status, isAdmin, broadcastInventory, setView]);

  useEffect(() => {
    if (step === 'scanning') {
      const initCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          streamRef.current = stream;
          if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        } catch (err) {}
      };
      initCamera();
    }
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };
  }, [step]);

  useEffect(() => {
    let interval: any;
    if (step === 'scanning' && 'BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      interval = setInterval(async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const { peer } = useSync();
            const decompressed = LZString.decompressFromEncodedURIComponent(codes[0].rawValue);
            if (peer && decompressed) {
              const payload = JSON.parse(decompressed);
              peer.signal(payload.signal);
              clearInterval(interval);
            }
          }
        } catch (e) {}
      }, 500);
    }
    return () => clearInterval(interval);
  }, [step]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="bg-emerald-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-[-40px] bottom-[-40px] opacity-10"><ArrowRightLeft size={240} /></div>
        <div className="relative z-10 flex items-center gap-6">
          <div className="w-16 h-16 bg-white rounded-2xl p-2 flex items-center justify-center shadow-lg"><img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" /></div>
          <div>
             <h2 className="text-4xl font-black tracking-tight">Sync Station</h2>
             <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-1">Robust Wi-Fi & WhatsApp Link</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm min-h-[550px] flex flex-col justify-center items-center relative">
        {status === 'live' ? (
           <div className="text-center space-y-6 animate-in zoom-in">
              <div className="w-32 h-32 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><CheckCircle2 size={80} className="animate-bounce" /></div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Terminal Bridge: Live</h3>
              <p className="text-slate-500 font-medium">Auto-pushing data via WebRTC bridge...</p>
           </div>
        ) : step === 'idle' ? (
          <div className="w-full max-w-2xl space-y-10 animate-in fade-in">
            <div className="text-center space-y-2">
               <h3 className="text-2xl font-black text-slate-800 tracking-tight">Select Sync Method</h3>
               <p className="text-slate-500 text-sm">Use Wi-Fi for speed, or WhatsApp for 100% reliability.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <button onClick={() => handleStartSync(isAdmin)} className="group p-8 bg-emerald-50 border-2 border-emerald-100 rounded-[2.5rem] hover:border-emerald-500 transition-all text-left flex items-center gap-6 shadow-sm">
                 <div className="p-5 bg-white rounded-2xl text-emerald-600 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all"><Wifi size={32} /></div>
                 <div><p className="font-black text-xl">Wi-Fi Link</p><p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1">Direct P2P Bridge</p></div>
               </button>
               <button onClick={() => setStep('whatsapp')} className="group p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] hover:border-emerald-500 transition-all text-left flex items-center gap-6 shadow-sm">
                 <div className="p-5 bg-white rounded-2xl text-slate-400 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all"><MessageSquare size={32} /></div>
                 <div><p className="font-black text-xl">WhatsApp Link</p><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">100% Failure Fallback</p></div>
               </button>
            </div>

            <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 flex items-start gap-4">
              <Info size={20} className="text-amber-600 shrink-0 mt-1" />
              <div className="space-y-1">
                 <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none">Pro-Tip for Wi-Fi Sync</p>
                 <p className="text-xs text-slate-500 font-medium leading-relaxed">If using a phone Hotspot, ensure the Guest phone has <b>Mobile Data turned OFF</b> to force connection over the local link.</p>
              </div>
            </div>
          </div>
        ) : step === 'whatsapp' ? (
          <div className="w-full max-w-lg space-y-8 animate-in zoom-in">
             <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><MessageSquare size={32} /></div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">WhatsApp Data Bridge</h3>
                <p className="text-slate-500 text-sm">Sync even when phones are miles apart.</p>
             </div>

             <div className="space-y-6">
                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 text-center space-y-4">
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Step 1: Outgoing Data</p>
                   <p className="text-sm font-bold text-slate-600">Export {isAdmin ? 'Product Catalog' : "Today's Sales"} as a compressed string.</p>
                   <button 
                     onClick={handleWhatsAppExport}
                     disabled={isProcessing}
                     className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all disabled:opacity-50"
                   >
                     {isProcessing ? <Loader2 size={24} className="animate-spin" /> : <><Share2 size={20} /> Export to WhatsApp</>}
                   </button>
                </div>

                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 space-y-4">
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center">Step 2: Incoming Data</p>
                   <textarea 
                     className="w-full h-32 p-4 bg-white border border-slate-200 rounded-2xl font-mono text-[10px] outline-none focus:ring-2 focus:ring-emerald-500"
                     placeholder="Paste the message received from WhatsApp here..."
                     value={manualInput}
                     onChange={(e) => setManualInput(e.target.value)}
                   />
                   <button 
                     onClick={handleWhatsAppImport}
                     disabled={isProcessing || !manualInput}
                     className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                   >
                     {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <><ClipboardPaste size={18} /> Process Pasted Data</>}
                   </button>
                </div>
             </div>

             <button onClick={() => setStep('idle')} className="w-full py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-colors">Back to Modes</button>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-8 animate-in fade-in">
            <div className="text-center space-y-2">
              <h4 className="text-2xl font-black text-slate-800 tracking-tight">
                {status === 'connecting' ? 'Bridging Terminals...' : 'Handshake Ready'}
              </h4>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Session ID: {sessionId}</p>
            </div>

            {qrData && step === 'showing' && (
               <div className="space-y-6 flex flex-col items-center">
                  <div className="p-6 bg-white border-8 border-emerald-500 rounded-[3rem] shadow-2xl inline-block relative overflow-hidden group">
                    <img src={qrData} alt="Handshake QR" className="w-64 h-64 rounded-xl transition-all group-hover:scale-105" />
                    <div className="absolute inset-0 bg-emerald-600/10 animate-pulse pointer-events-none" />
                  </div>
                  <button onClick={() => setStep('scanning')} className="w-full px-12 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xl flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all">
                    <Camera size={24} /> Next: Scan Other Terminal
                  </button>
               </div>
            )}

            {step === 'scanning' && (
              <div className="w-full max-w-sm space-y-6">
                <div className="aspect-square bg-slate-900 rounded-[3rem] overflow-hidden border-4 border-emerald-500 relative shadow-2xl">
                   <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                   <div className="absolute inset-0 border-[40px] border-black/40"><div className="w-full h-full border-2 border-emerald-400 rounded-xl relative shadow-[0_0_50px_rgba(16,185,129,0.3)]"><div className="animate-scan"></div></div></div>
                </div>
                <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200 flex items-start gap-3">
                   <Zap size={20} className="text-amber-500 shrink-0" />
                   <p className="text-[10px] text-amber-700 font-bold leading-relaxed">Scanning fresh handshake signal. Ensure the other terminal is showing its QR code.</p>
                </div>
              </div>
            )}
            
            <button onClick={cleanup} className="flex items-center gap-2 text-rose-500 font-bold px-8 py-4 rounded-[2rem] hover:bg-rose-50 transition-all uppercase text-xs tracking-widest border border-rose-100"><X size={18} /> Cancel & Force Reset</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncStation;
