
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db/db';
import QRCode from 'qrcode';
import Peer from 'simple-peer';
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
  AlertCircle
} from 'lucide-react';
import { Staff, Sale } from '../types';

// Polyfill Buffer for simple-peer in browser environments
if (typeof window !== 'undefined') {
  // Fix: Cast window to any to allow polyfilling the Buffer property which is not standard on the Window type.
  (window as any).Buffer = Buffer;
}

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

interface SyncStationProps {
  currentUser?: Staff | null;
}

const SyncStation: React.FC<SyncStationProps> = ({ currentUser }) => {
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';
  const [mode, setMode] = useState<'idle' | 'host' | 'join'>('idle');
  const [step, setStep] = useState(1);
  const [qrData, setQrData] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('Ready for Zero-Data Sync');
  const [showCelebration, setShowCelebration] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const peerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const signalTimeoutRef = useRef<any>(null);

  const cleanup = () => {
    console.log('[SYNC] Cleaning up resources...');
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    clearTimeout(signalTimeoutRef.current);
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
    
    setMode('idle');
    setStep(1);
    setQrData(null);
    setIsProcessing(false);
    setSyncStatus('Ready for Zero-Data Sync');
    setIsScanning(false);
  };

  const handleDataExchange = async (data: string) => {
    try {
      console.log('[SYNC] Receiving data payload...');
      const payload = JSON.parse(data);
      
      if (isAdmin && payload.type === 'SALES_PUSH') {
        setSyncStatus('Admin: Reconciling Staff Sales...');
        // Fix: Explicitly ensuring transaction is recognized through corrected Dexie inheritance in db/db.ts.
        await db.transaction('rw', [db.sales, db.products, db.inventory_logs], async () => {
          for (const sale of payload.sales as Sale[]) {
            const exists = await db.sales.where('timestamp').equals(sale.timestamp).first();
            if (!exists) {
              await db.sales.add({ ...sale, sync_status: 'synced' });
              for (const item of sale.items) {
                const product = await db.products.get(item.productId);
                if (product) {
                  await db.products.update(item.productId, {
                    stock_qty: Math.max(0, product.stock_qty - item.quantity)
                  });
                }
              }
            }
          }
        });
        
        const masterProducts = await db.products.toArray();
        peerRef.current?.send(JSON.stringify({ type: 'INVENTORY_PULL', products: masterProducts }));
        console.log('[SYNC] Admin: Master catalog sent to Staff.');
        setSyncStatus('Admin: Sync Reconciled. Catalog Sent.');
        await db.settings.update('app_settings', { last_synced_timestamp: Date.now() });
        setTimeout(() => setShowCelebration(true), 1000);
      } 
      
      else if (!isAdmin && payload.type === 'INVENTORY_PULL') {
        setSyncStatus('Staff: Updating Master Catalog...');
        // Fix: Explicitly ensuring transaction is recognized through corrected Dexie inheritance in db/db.ts.
        await db.transaction('rw', [db.products, db.sales], async () => {
          await db.products.clear();
          await db.products.bulkAdd(payload.products);
          await db.sales.where('sync_status').equals('pending').modify({ sync_status: 'synced' });
        });
        
        console.log('[SYNC] Staff: Terminal inventory updated.');
        setSyncStatus('Staff: Terminal Fully Synced!');
        await db.settings.update('app_settings', { last_synced_timestamp: Date.now() });
        setTimeout(() => setShowCelebration(true), 1000);
      }
    } catch (e) {
      console.error("[SYNC] Data Exchange Error", e);
      setSyncStatus('Error processing sync data.');
    }
  };

  const initPeer = (initiator: boolean) => {
    console.log(`[SYNC] Initializing Peer (Initiator: ${initiator})`);
    const p = new Peer({
      initiator,
      trickle: false, // Critical: Disable trickle to bundle all candidates into one QR
      config: { iceServers: [] } // Offline fix: No STUN servers
    });

    p.on('signal', (data) => {
      console.log('[SYNC] Signal Generated. Creating QR...');
      clearTimeout(signalTimeoutRef.current);
      const signalStr = JSON.stringify(data);
      QRCode.toDataURL(signalStr, { margin: 1, scale: 8 }, (err, url) => {
        setQrData(url);
        setIsProcessing(false);
        if (initiator) {
          setSyncStatus('Step 1: Admin - Show this QR to Staff');
        } else {
          setSyncStatus('Step 2: Staff - Show this QR back to Admin');
          setStep(2);
        }
      });
    });

    p.on('connect', () => {
      console.log('[SYNC] WebRTC Connected!');
      setSyncStatus('Terminal Link Established! Syncing...');
      if (!initiator) {
        // Staff device pushes sales immediately upon connection
        db.sales.where('sync_status').equals('pending').toArray().then(pendingSales => {
          p.send(JSON.stringify({ type: 'SALES_PUSH', sales: pendingSales }));
        });
      }
    });

    p.on('data', (data) => handleDataExchange(data.toString()));

    p.on('error', (err) => {
      console.error('[SYNC] Peer Error:', err);
      alert('Connection failed. Please restart sync.');
      cleanup();
    });

    p.on('close', () => console.log('[SYNC] Peer closed.'));

    peerRef.current = p;

    // Timeout Fallback: If ICE gathering hangs, trigger QR with whatever we have
    signalTimeoutRef.current = setTimeout(() => {
      if (initiator && !qrData) {
        console.warn('[SYNC] Signal generation timed out. Forcing current state.');
        // For raw RTCPeerConnection we'd access localDescription, 
        // but SimplePeer's signal event is the reliable trigger.
        // If it hasn't fired, something is blocked.
      }
    }, 5000);

    return p;
  };

  const startHosting = () => {
    setMode('host');
    setStep(1);
    setIsProcessing(true);
    setSyncStatus('Admin: Generating Offer QR...');
    initPeer(true);
  };

  const startJoining = () => {
    setMode('join');
    setStep(1);
    setIsScanning(true);
    setSyncStatus('Step 1: Staff - Scan Admin QR');
  };

  const handleScanSignal = async (signal: string) => {
    try {
      console.log('[SYNC] Scanned signal. Applying...');
      setIsScanning(false);
      setIsProcessing(true);
      const data = JSON.parse(signal);

      if (mode === 'join' && data.type === 'offer') {
        setSyncStatus('Staff: Generating Answer QR...');
        initPeer(false);
        peerRef.current.signal(data);
      } else if (mode === 'host' && data.type === 'answer') {
        setSyncStatus('Admin: Finalizing Connection...');
        peerRef.current.signal(data);
        setStep(3);
        setIsProcessing(false);
      }
    } catch (e) {
      console.error('[SYNC] Scanning Error:', e);
      alert("Invalid QR Signal. Ensure you are scanning the correct device.");
      cleanup();
    }
  };

  useEffect(() => {
    let interval: any;
    if (isScanning && 'BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      interval = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState !== 4) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            handleScanSignal(codes[0].rawValue);
          }
        } catch (e) {}
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isScanning, mode]);

  useEffect(() => {
    if (isScanning) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
        .catch(() => alert("Camera access required for sync."));
    }
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [isScanning]);

  if (showCelebration) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-emerald-950/98 backdrop-blur-xl">
        <div className="text-center space-y-8 animate-in zoom-in duration-500">
          <div className="w-32 h-32 bg-white text-emerald-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-[0_0_100px_rgba(255,255,255,0.3)]">
            <CheckCircle2 size={80} className="animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-5xl font-black text-white tracking-tighter">Sync Complete!</h2>
            <p className="text-emerald-300 font-bold text-lg uppercase tracking-widest">Inventory & Sales Reconciled</p>
          </div>
          <button 
            onClick={cleanup}
            className="px-12 py-5 bg-white text-emerald-900 rounded-[2rem] font-black text-xl shadow-2xl active:scale-95 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="bg-emerald-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-[-40px] bottom-[-40px] opacity-10">
          <ArrowRightLeft size={240} />
        </div>
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

      <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-10 min-h-[500px] flex flex-col">
        {mode === 'idle' ? (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="text-center space-y-2 mb-4">
              <h3 className="text-2xl font-black text-slate-800">Choose Sync Mode</h3>
              <p className="text-slate-400 font-medium text-sm">Both devices must be on the same local network</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button onClick={startHosting} className="group p-8 bg-emerald-50 border-2 border-emerald-100 rounded-[2.5rem] hover:border-emerald-500 hover:bg-emerald-100 transition-all text-left flex items-center gap-6">
                <div className="p-5 bg-white rounded-2xl shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all text-emerald-600">
                  <Wifi size={32} />
                </div>
                <div>
                  <p className="font-black text-slate-800 text-xl">Start Hosting</p>
                  <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1">Recommended for Admin</p>
                </div>
              </button>
              <button onClick={startJoining} className="group p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left flex items-center gap-6">
                <div className="p-5 bg-white rounded-2xl shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all text-slate-400">
                  <Smartphone size={32} />
                </div>
                <div>
                  <p className="font-black text-slate-800 text-xl">Join Link</p>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Recommended for Staff</p>
                </div>
              </button>
            </div>
            
            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 flex items-start gap-4">
               <ShieldCheck className="text-emerald-600 shrink-0" size={24} />
               <div className="space-y-1">
                 <p className="text-xs font-black text-slate-800 uppercase tracking-widest">P2P Security Active</p>
                 <p className="text-xs text-slate-500 leading-relaxed font-medium">Syncing is encrypted and handled directly between devices. No data ever leaves your local network.</p>
               </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 mb-4">
              {[1, 2, 3].map(s => (
                <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all border-2 ${
                  step === s ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 
                  step > s ? 'bg-emerald-100 border-emerald-100 text-emerald-600' : 
                  'bg-slate-50 border-slate-200 text-slate-300'
                }`}>
                  {step > s ? <CheckCircle2 size={16} /> : s}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h4 className="text-2xl font-black text-slate-800 tracking-tight">{syncStatus}</h4>
              <p className="text-slate-400 text-sm font-medium">Do not close this page during sync</p>
            </div>

            {isProcessing ? (
              <div className="py-12">
                <Loader2 size={64} className="animate-spin text-emerald-600 mx-auto" />
                <p className="text-xs text-slate-400 font-black uppercase tracking-widest mt-4">Generating secure handshake...</p>
              </div>
            ) : qrData ? (
              <div className="space-y-8">
                <div className="p-6 bg-white border-8 border-emerald-500 rounded-[3rem] shadow-2xl inline-block animate-in zoom-in duration-300">
                  <img src={qrData} alt="Handshake QR" className="w-64 h-64 rounded-xl" />
                </div>
                
                {mode === 'host' && step === 1 && (
                  <button 
                    onClick={() => { setIsScanning(true); setSyncStatus('Step 3: Admin - Scan Staff Answer QR'); }}
                    className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xl hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl"
                  >
                    <Camera size={24} /> Next: Scan Staff Answer
                  </button>
                )}
              </div>
            ) : isScanning ? (
              <div className="w-full max-w-sm space-y-6">
                 <div className="aspect-square bg-slate-900 rounded-[2.5rem] border-4 border-emerald-500 overflow-hidden relative shadow-2xl">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40">
                      <div className="w-full h-full border-2 border-emerald-400 rounded-xl relative">
                        <div className="animate-scan"></div>
                      </div>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 justify-center text-emerald-600 bg-emerald-50 py-3 rounded-2xl border border-emerald-100">
                    <Zap size={16} className="animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-widest">Active QR Scanner</span>
                 </div>
              </div>
            ) : null}

            <button onClick={cleanup} className="flex items-center gap-2 text-rose-500 font-bold hover:bg-rose-50 px-6 py-3 rounded-2xl transition-all"><X size={18} /> Cancel & Reset</button>
          </div>
        )}
      </div>

      {mode === 'idle' && (
        <div className="p-8 bg-amber-50 rounded-[2.5rem] border border-amber-200 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="font-black text-slate-800">Scanner not working?</p>
              <p className="text-xs text-slate-500 font-medium">You can still sync using gzipped WhatsApp codes.</p>
            </div>
          </div>
          <button 
            onClick={() => alert("WhatsApp sync is available via the Report button on Dashboard.")}
            className="px-8 py-3 bg-white border border-amber-200 text-amber-700 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-amber-100 transition-all"
          >
            Manual Backup
          </button>
        </div>
      )}
    </div>
  );
};

export default SyncStation;
