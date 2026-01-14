
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../db/db';
import QRCode from 'qrcode';
import Peer from 'simple-peer';
import LZString from 'lz-string';
import { Buffer } from 'buffer';
import { 
  Wifi, 
  QrCode, 
  Smartphone, 
  Loader2, 
  X,
  Camera,
  ArrowRightLeft,
  CheckCircle2,
  Zap,
  ShieldCheck,
  AlertCircle,
  PackageCheck,
  ReceiptText,
  ClipboardPaste,
  Clock,
  ClipboardList,
  MessageSquare,
  RefreshCw,
  Info
} from 'lucide-react';
import { Staff, Sale, View } from '../types';

if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
}

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

interface SyncStationProps {
  currentUser?: Staff | null;
  setView: (view: View) => void;
}

type SyncStep = 'idle' | 'generating' | 'showing-qr' | 'showing-answer' | 'scanning-answer' | 'syncing' | 'failed';

const SyncStation: React.FC<SyncStationProps> = ({ currentUser, setView }) => {
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';
  
  const [mode, setMode] = useState<'idle' | 'host' | 'join'>('idle');
  const [syncStep, setSyncStep] = useState<SyncStep>('idle');
  const [isFinished, setIsFinished] = useState(false);
  const [syncSummary, setSyncSummary] = useState({ products: 0, sales: 0 });
  const [manualInput, setManualInput] = useState('');
  
  const [qrData, setQrData] = useState<string | null>(null);
  const [rawSignal, setRawSignal] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('Ready for Zero-Data Sync');
  const [isOpeningCamera, setIsOpeningCamera] = useState(false);

  const peerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const connectionTimeoutRef = useRef<any>(null);
  const answerGenerationTimeoutRef = useRef<any>(null);

  const stopAllMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.load();
    }
  }, []);

  const cleanup = useCallback(() => {
    console.log('[SYNC] Total Reset Initiated...');
    stopAllMedia();
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    clearTimeout(connectionTimeoutRef.current);
    clearTimeout(answerGenerationTimeoutRef.current);
    
    if (isFinished) {
      setView('dashboard');
    } else {
      setMode('idle');
      setSyncStep('idle');
      setIsFinished(false);
      setQrData(null);
      setRawSignal(null);
      setSyncStatus('Ready for Zero-Data Sync');
      setIsOpeningCamera(false);
      setManualInput('');
    }
  }, [isFinished, setView, stopAllMedia]);

  // FORCE RESET ON ENTRY: UseEffect triggers on component mount
  useEffect(() => {
    cleanup();
    return () => {
      // Destructive cleanup on unmount
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  const handleDataExchange = async (data: string) => {
    try {
      const payload = JSON.parse(data);
      
      if (isAdmin && payload.type === 'SALES_PUSH') {
        setSyncStatus('Admin: Reconciling Staff Sales...');
        setSyncStep('syncing');
        
        const salesToSync = payload.sales as Sale[];
        await (db as any).transaction('rw', [db.sales, db.products, db.inventory_logs], async () => {
          for (const sale of salesToSync) {
            const exists = await db.sales.where('timestamp').equals(sale.timestamp).first();
            if (!exists) {
              await db.sales.add({ ...sale, sync_status: 'synced' });
              for (const item of sale.items) {
                const product = await db.products.get(item.productId);
                if (product) {
                  await db.products.update(item.productId, {
                    stock_qty: Math.max(0, (product.stock_qty || 0) - item.quantity)
                  });
                }
              }
            }
          }
        });
        
        const masterProducts = await db.products.toArray();
        peerRef.current?.send(JSON.stringify({ type: 'INVENTORY_PULL', products: masterProducts }));
        
        setSyncSummary({ sales: salesToSync.length, products: 0 });
        setSyncStatus('Admin: Sync Reconciled. Catalog Sent.');
        await db.settings.update('app_settings', { last_synced_timestamp: Date.now() });
        setTimeout(() => setIsFinished(true), 1500);
      } 
      else if (!isAdmin && payload.type === 'INVENTORY_PULL') {
        setSyncStatus('Staff: Updating Master Catalog...');
        setSyncStep('syncing');
        
        const productsToSync = payload.products;
        await (db as any).transaction('rw', [db.products, db.sales], async () => {
          await db.products.clear();
          await db.products.bulkAdd(productsToSync);
          await db.sales.where('sync_status').equals('pending').modify({ sync_status: 'synced' });
        });
        
        setSyncSummary({ products: productsToSync.length, sales: 0 });
        setSyncStatus('Staff: Terminal Fully Synced!');
        await db.settings.update('app_settings', { last_synced_timestamp: Date.now() });
        setTimeout(() => setIsFinished(true), 1500);
      }
    } catch (e) {
      console.error("[SYNC] Data Exchange Error", e);
      setSyncStatus('Error processing sync data.');
      setSyncStep('failed');
    }
  };

  const initPeer = (initiator: boolean) => {
    console.log(`[SYNC] Initializing BRAND NEW Peer (initiator: ${initiator})`);
    setSyncStep('generating');
    
    // Explicit destruction before creating new instance
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    const p = new Peer({
      initiator,
      trickle: false, // MANDATORY: Trickle false for static QR
      config: { iceServers: [] } 
    });

    p.on('signal', (data) => {
      console.log('[SYNC] Local Signal Generated:', data.type);
      clearTimeout(answerGenerationTimeoutRef.current);
      
      const signalStr = JSON.stringify(data);
      // CLEANING: Use LZString to keep QR code small and simple
      const compressed = LZString.compressToEncodedURIComponent(signalStr);
      setRawSignal(compressed);
      
      QRCode.toDataURL(compressed, { margin: 1, scale: 8 }, (err, url) => {
        if (err) return;
        setQrData(url);
        if (mode === 'join' || !initiator) {
          setSyncStep('showing-answer');
          setSyncStatus('Staff - Show this Answer QR back to Admin');
        } else {
          setSyncStep('showing-qr');
          setSyncStatus('Admin - Show this QR to Staff');
        }
      });
    });

    p.on('connect', () => {
      console.log('[SYNC] P2P CONNECTED!');
      clearTimeout(connectionTimeoutRef.current);
      setSyncStatus('Terminal Link Established! Syncing...');
      setSyncStep('syncing');
      if (!initiator) {
        db.sales.where('sync_status').equals('pending').toArray().then(pendingSales => {
          p.send(JSON.stringify({ type: 'SALES_PUSH', sales: pendingSales }));
        });
      }
    });

    p.on('data', (data) => handleDataExchange(data.toString()));
    p.on('error', (err) => {
      console.error('[SYNC] Peer Error:', err);
      setSyncStep('failed');
      setSyncStatus('Connection Failed. Please reset and try again.');
    });

    peerRef.current = p;
    return p;
  };

  const startHosting = () => {
    setMode('host');
    initPeer(true);
  };

  const startJoining = () => {
    setMode('join');
    setSyncStep('scanning-answer');
    setSyncStatus('Staff - Scan Admin QR');
  };

  const startScanning = async () => {
    setIsOpeningCamera(true);
    setSyncStep('scanning-answer');
    setSyncStatus(mode === 'host' ? 'Admin - Scan Staff Answer QR' : 'Staff - Scan Admin QR');
  };

  const handleScanSignal = useCallback(async (signal: string) => {
    try {
      console.log('[SYNC] Compressed Signal Received from Scan');
      stopAllMedia();
      
      // DECOMPRESS: Clean signal back to JSON
      const decompressed = LZString.decompressFromEncodedURIComponent(signal);
      if (!decompressed) throw new Error("Decompression Failed");
      
      const data = JSON.parse(decompressed);

      if (mode === 'join' && data.type === 'offer') {
        console.log('[SYNC] Staff received Admin signal, generating answer...');
        setSyncStep('generating');
        setSyncStatus('Generating Answer Signal...');
        
        answerGenerationTimeoutRef.current = setTimeout(() => {
          setSyncStep('failed');
          setSyncStatus('Failed to generate answer. Please refresh.');
        }, 5000);

        const p = initPeer(false);
        p.signal(data);
      } else if (mode === 'host' && data.type === 'answer') {
        setSyncStep('syncing');
        setSyncStatus('Establishing P2P Handshake...');
        
        connectionTimeoutRef.current = setTimeout(() => {
          setSyncStep('failed');
          setSyncStatus('Connection Timeout. Check Wi-Fi settings.');
        }, 15000);

        if (!peerRef.current || peerRef.current.destroyed) {
          throw new Error("Peer instance is dead. Restart required.");
        }
        peerRef.current.signal(data);
      }
    } catch (e) {
      console.error('[SYNC] Signal Processing Error:', e);
      setSyncStep('failed');
      setSyncStatus('Invalid QR format. Please use the current session QR.');
    }
  }, [mode, stopAllMedia]);

  const handleManualPaste = () => {
    if (!manualInput.trim()) return;
    handleScanSignal(manualInput.trim());
  };

  useEffect(() => {
    if (syncStep === 'scanning-answer') {
      const initCamera = async () => {
        try {
          stopAllMedia(); 
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }
          setIsOpeningCamera(false);
        } catch (err) {
          console.error('[SYNC] Camera Access Error:', err);
          setIsOpeningCamera(false);
        }
      };
      initCamera();
    }
    return () => {
      if (syncStep !== 'scanning-answer') stopAllMedia();
    };
  }, [syncStep, stopAllMedia]);

  useEffect(() => {
    let interval: any;
    if (syncStep === 'scanning-answer' && 'BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      interval = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState !== 4) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            clearInterval(interval);
            handleScanSignal(codes[0].rawValue);
          }
        } catch (e) {}
      }, 500);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [syncStep, handleScanSignal]);

  if (isFinished) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-emerald-950/98 backdrop-blur-xl">
        <div className="text-center space-y-8 animate-in zoom-in duration-500">
          <div className="w-32 h-32 bg-white text-emerald-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-[0_0_100px_rgba(255,255,255,0.3)]">
            <CheckCircle2 size={80} className="animate-bounce" />
          </div>
          <div className="space-y-4">
            <h2 className="text-5xl font-black text-white tracking-tighter">Sync Complete!</h2>
            <div className="flex flex-col items-center gap-3">
               {isAdmin ? (
                 <div className="flex items-center gap-3 bg-white/10 px-6 py-3 rounded-2xl border border-white/10 text-emerald-300">
                   <ReceiptText size={20} />
                   <span className="font-bold text-lg">{syncSummary.sales} Staff Sales Reconciled</span>
                 </div>
               ) : (
                 <div className="flex items-center gap-3 bg-white/10 px-6 py-3 rounded-2xl border border-white/10 text-emerald-300">
                   <PackageCheck size={20} />
                   <span className="font-bold text-lg">{syncSummary.products} Products Updated</span>
                 </div>
               )}
            </div>
          </div>
          <button onClick={cleanup} className="px-12 py-5 bg-white text-emerald-900 rounded-[2rem] font-black text-xl shadow-2xl active:scale-95 transition-all hover:bg-emerald-50">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="bg-emerald-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-[-40px] bottom-[-40px] opacity-10"><ArrowRightLeft size={240} /></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
          <div className="w-16 h-16 bg-white rounded-2xl p-2 flex items-center justify-center shadow-lg shrink-0">
            <img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-4xl font-black tracking-tight">Sync Station</h2>
            <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-1">Direct Wi-Fi Terminal Link</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-10 min-h-[500px] flex flex-col relative">
        {syncStep === 'idle' ? (
          <div className="flex-1 flex flex-col justify-center space-y-6 animate-in fade-in duration-300">
            <div className="text-center space-y-2 mb-4">
              <h3 className="text-2xl font-black text-slate-800">Choose Sync Mode</h3>
              <p className="text-slate-400 font-medium text-sm">Both devices must be on the same local network</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button onClick={startHosting} className="group p-8 bg-emerald-50 border-2 border-emerald-100 rounded-[2.5rem] hover:border-emerald-500 hover:bg-emerald-100 transition-all text-left flex items-center gap-6">
                <div className="p-5 bg-white rounded-2xl shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all text-emerald-600"><Wifi size={32} /></div>
                <div><p className="font-black text-slate-800 text-xl">Start Hosting</p><p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1">Recommended for Admin</p></div>
              </button>
              <button onClick={startJoining} className="group p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left flex items-center gap-6">
                <div className="p-5 bg-white rounded-2xl shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all text-slate-400"><Smartphone size={32} /></div>
                <div><p className="font-black text-slate-800 text-xl">Join Link</p><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Recommended for Staff</p></div>
              </button>
            </div>
            
            {/* Hotspot Advice */}
            <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 flex items-start gap-4">
               <Info size={20} className="text-amber-600 shrink-0 mt-1" />
               <div className="space-y-1">
                  <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Hotspot Connection Tips</p>
                  <p className="text-xs text-slate-500 font-medium">If using a phone Hotspot: Ensure the Staff phone has <b>Mobile Data turned OFF</b>. Some Android devices try to sync over 4G instead of the Wi-Fi link.</p>
               </div>
            </div>
          </div>
        ) : syncStep === 'failed' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in duration-300">
             <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shadow-inner">
                <AlertCircle size={40} />
             </div>
             <div className="space-y-2">
                <h4 className="text-2xl font-black text-slate-800">{syncStatus}</h4>
                <p className="text-slate-500 text-sm font-medium px-10">Peer connection was interrupted or timed out. Handshake signals are only valid for the current session.</p>
             </div>
             <div className="w-full max-w-sm space-y-3">
                <button 
                  onClick={cleanup}
                  className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-xl shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw size={24} /> Reset & Try Again
                </button>
                <button 
                  onClick={() => setView('dashboard')}
                  className="w-full py-3 text-slate-400 font-bold text-xs uppercase tracking-widest"
                >
                  Return to Dashboard
                </button>
             </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 mb-4">
              {['generating', 'showing-qr', 'scanning-answer', 'syncing'].map((s, idx) => {
                const stepIdx = ['generating', 'showing-qr', 'scanning-answer', 'syncing'].indexOf(syncStep === 'showing-answer' ? 'showing-qr' : syncStep);
                return (
                    <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all border-2 ${
                        idx === stepIdx ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 
                        idx < stepIdx ? 'bg-emerald-100 border-emerald-100 text-emerald-600' : 
                        'bg-slate-50 border-slate-200 text-slate-300'
                    }`}>{idx < stepIdx ? <CheckCircle2 size={16} /> : idx + 1}</div>
                );
              })}
            </div>

            <h4 className="text-2xl font-black text-slate-800 tracking-tight">{syncStatus}</h4>

            {(syncStep === 'showing-qr' || syncStep === 'showing-answer') && qrData && (
              <div className="space-y-8 animate-in zoom-in duration-300 flex flex-col items-center w-full">
                <div className="p-6 bg-white border-8 border-emerald-500 rounded-[3rem] shadow-2xl inline-block">
                  <img src={qrData} alt="Handshake QR" className="w-64 h-64 rounded-xl" />
                </div>
                
                {mode === 'host' && syncStep === 'showing-qr' && (
                  <button onClick={startScanning} disabled={isOpeningCamera} className="w-full max-w-sm py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xl hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-50">
                    <Camera size={24} /> Next: Scan Staff Phone
                  </button>
                )}

                {mode === 'join' && syncStep === 'showing-answer' && (
                   <div className="w-full max-w-sm space-y-4">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">QR Blurry? Use Manual Code:</p>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left">
                         <code className="text-[10px] break-all block max-h-24 overflow-y-auto scrollbar-hide font-mono text-slate-600">
                            {rawSignal}
                         </code>
                      </div>
                      <button 
                         onClick={() => {
                            if (rawSignal) {
                               navigator.clipboard.writeText(rawSignal);
                               alert("Answer code copied to clipboard!");
                            }
                         }}
                         className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 border border-slate-200"
                      >
                         <MessageSquare size={14} /> Copy Code for Admin
                      </button>
                   </div>
                )}
              </div>
            )}

            {syncStep === 'scanning-answer' && (
              <div key="scanner-container" className="w-full max-w-sm space-y-6 z-50 relative animate-in zoom-in duration-300">
                 <div className="aspect-square bg-slate-900 rounded-[2.5rem] border-4 border-emerald-500 overflow-hidden relative shadow-2xl">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40"><div className="w-full h-full border-2 border-emerald-400 rounded-xl relative"><div className="animate-scan"></div></div></div>
                    {isOpeningCamera && <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center gap-4"><Loader2 size={48} className="animate-spin text-emerald-500" /></div>}
                 </div>
                 
                 <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Camera Issue? Paste Code Manually:</p>
                    <textarea 
                       className="w-full h-24 p-4 bg-white border border-slate-200 rounded-2xl font-mono text-[10px] outline-none focus:ring-2 focus:ring-emerald-500"
                       placeholder="Paste the other phone's signal signal here..."
                       value={manualInput}
                       onChange={(e) => setManualInput(e.target.value)}
                    />
                    <button 
                       onClick={handleManualPaste}
                       className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                       <ClipboardPaste size={14} /> Finish Link Manually
                    </button>
                 </div>
              </div>
            )}

            {syncStep === 'generating' && (
                <div className="py-20 animate-in zoom-in duration-300 text-center">
                    <Loader2 size={64} className="animate-spin text-emerald-600 mx-auto" />
                    <p className="text-xs text-slate-400 font-black uppercase tracking-widest mt-6">Generating Cryptographic Signal...</p>
                </div>
            )}

            {syncStep === 'syncing' && (
                <div className="py-20 animate-in zoom-in duration-300 text-center">
                    <Loader2 size={64} className="animate-spin text-emerald-600 mx-auto" />
                    <p className="text-xs text-slate-400 font-black uppercase tracking-widest mt-6">Handshaking & Data Exchange...</p>
                </div>
            )}

            <button onClick={cleanup} className="flex items-center gap-2 text-rose-500 font-bold hover:bg-rose-50 px-6 py-3 rounded-2xl transition-all"><X size={18} /> Cancel & Reset</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncStation;
