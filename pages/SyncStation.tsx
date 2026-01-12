
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  AlertCircle,
  PackageCheck,
  ReceiptText
} from 'lucide-react';
import { Staff, Sale, View } from '../types';

// Polyfill Buffer for simple-peer in browser environments
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
}

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

interface SyncStationProps {
  currentUser?: Staff | null;
  setView: (view: View) => void;
}

// Refined steps for clearer state transitions
type SyncStep = 'idle' | 'generating' | 'showing-qr' | 'scanning-answer' | 'syncing';

const SyncStation: React.FC<SyncStationProps> = ({ currentUser, setView }) => {
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';
  
  const [mode, setMode] = useState<'idle' | 'host' | 'join'>('idle');
  const [syncStep, setSyncStep] = useState<SyncStep>('idle');
  const [isFinished, setIsFinished] = useState(false);
  const [syncSummary, setSyncSummary] = useState({ products: 0, sales: 0 });
  
  const [qrData, setQrData] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('Ready for Zero-Data Sync');
  const [isOpeningCamera, setIsOpeningCamera] = useState(false);

  const peerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const signalTimeoutRef = useRef<any>(null);

  // 1. Explicit Camera Stop Utility
  const stopAllMedia = useCallback(() => {
    console.log('[SYNC] Explicitly stopping all media tracks...');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`[SYNC] Track ${track.kind} stopped`);
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.load(); // Force release
    }
  }, []);

  const cleanup = () => {
    console.log('[SYNC] Total cleanup requested...');
    stopAllMedia();
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    clearTimeout(signalTimeoutRef.current);
    
    if (isFinished) {
      setView('dashboard');
    } else {
      setMode('idle');
      setSyncStep('idle');
      setIsFinished(false);
      setQrData(null);
      setSyncStatus('Ready for Zero-Data Sync');
      setIsOpeningCamera(false);
    }
  };

  const handleDataExchange = async (data: string) => {
    try {
      const payload = JSON.parse(data);
      
      if (isAdmin && payload.type === 'SALES_PUSH') {
        setSyncStatus('Admin: Reconciling Staff Sales...');
        setSyncStep('syncing');
        
        const salesToSync = payload.sales as Sale[];
        await db.transaction('rw', [db.sales, db.products, db.inventory_logs], async () => {
          for (const sale of salesToSync) {
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
        
        setSyncSummary({ sales: salesToSync.length, products: 0 });
        setSyncStatus('Admin: Sync Reconciled. Catalog Sent.');
        await db.settings.update('app_settings', { last_synced_timestamp: Date.now() });
        setTimeout(() => setIsFinished(true), 1200);
      } 
      else if (!isAdmin && payload.type === 'INVENTORY_PULL') {
        setSyncStatus('Staff: Updating Master Catalog...');
        setSyncStep('syncing');
        
        const productsToSync = payload.products;
        await db.transaction('rw', [db.products, db.sales], async () => {
          await db.products.clear();
          await db.products.bulkAdd(productsToSync);
          await db.sales.where('sync_status').equals('pending').modify({ sync_status: 'synced' });
        });
        
        setSyncSummary({ products: productsToSync.length, sales: 0 });
        setSyncStatus('Staff: Terminal Fully Synced!');
        await db.settings.update('app_settings', { last_synced_timestamp: Date.now() });
        setTimeout(() => setIsFinished(true), 1200);
      }
    } catch (e) {
      console.error("[SYNC] Data Exchange Error", e);
      setSyncStatus('Error processing sync data.');
      setSyncStep('idle');
    }
  };

  const initPeer = (initiator: boolean) => {
    setSyncStep('generating');
    
    const p = new Peer({
      initiator,
      trickle: false,
      config: { iceServers: [] } 
    });

    p.on('signal', (data) => {
      clearTimeout(signalTimeoutRef.current);
      const signalStr = JSON.stringify(data);
      QRCode.toDataURL(signalStr, { margin: 1, scale: 8 }, (err, url) => {
        if (err) return;
        setQrData(url);
        setSyncStep('showing-qr');
        if (initiator) {
          setSyncStatus('Admin - Show this QR to Staff');
        } else {
          setSyncStatus('Staff - Show this QR back to Admin');
        }
      });
    });

    p.on('connect', () => {
      setSyncStatus('Terminal Link Established! Syncing...');
      setSyncStep('syncing');
      if (!initiator) {
        db.sales.where('sync_status').equals('pending').toArray().then(pendingSales => {
          p.send(JSON.stringify({ type: 'SALES_PUSH', sales: pendingSales }));
        });
      }
    });

    p.on('data', (data) => handleDataExchange(data.toString()));
    p.on('error', () => {
      alert('Connection failed. Please restart sync.');
      cleanup();
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
    if (mode === 'host') {
        setSyncStatus('Admin - Scan Staff Answer QR');
    } else {
        setSyncStatus('Staff - Scan Admin QR');
    }
  };

  // 2 & 4. Scan Success Handoff with Delay
  const handleScanSignal = useCallback(async (signal: string) => {
    try {
      console.log('[SYNC] Valid QR detected. Stopping camera immediately.');
      
      // Stop camera FIRST to prevent UI blocking
      stopAllMedia();
      
      // Move to a processing state to unmount video component
      setSyncStep('generating');
      setSyncStatus('Processing Connection...');

      const data = JSON.parse(signal);

      // Short delay to let mobile hardware release the lens and refresh the bus
      setTimeout(() => {
        if (mode === 'join' && data.type === 'offer') {
          setSyncStatus('Staff: Generating Answer QR...');
          initPeer(false);
          peerRef.current.signal(data);
        } else if (mode === 'host' && data.type === 'answer') {
          setSyncStatus('Admin: Finalizing Connection...');
          setSyncStep('syncing');
          peerRef.current.signal(data);
        }
      }, 350);
    } catch (e) {
      console.error('[SYNC] Scanning Error:', e);
      alert("Invalid QR. Ensure you are scanning the right device.");
      cleanup();
    }
  }, [mode, stopAllMedia]);

  // 3. Robust Cleanup Hook
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
          alert("Camera access required for sync.");
          cleanup();
        }
      };
      initCamera();
    }

    return () => {
      // Ensure camera dies when the state changes or component unmounts
      if (syncStep !== 'scanning-answer') {
        stopAllMedia();
      }
    };
  }, [syncStep, stopAllMedia]);

  // QR Decoder Loop with interval cleanup
  useEffect(() => {
    let interval: any;
    if (syncStep === 'scanning-answer' && 'BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      interval = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState !== 4) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            clearInterval(interval); // Stop scanning immediately
            handleScanSignal(codes[0].rawValue);
          }
        } catch (e) {}
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
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
          <button 
            onClick={cleanup}
            className="px-12 py-5 bg-white text-emerald-900 rounded-[2rem] font-black text-xl shadow-2xl active:scale-95 transition-all hover:bg-emerald-50"
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

      <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-10 min-h-[500px] flex flex-col relative">
        {syncStep === 'idle' ? (
          <div className="flex-1 flex flex-col justify-center space-y-6 animate-in fade-in duration-300">
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
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 mb-4">
              {['generating', 'showing-qr', 'scanning-answer', 'syncing'].map((s, idx) => {
                const stepIdx = ['generating', 'showing-qr', 'scanning-answer', 'syncing'].indexOf(syncStep);
                return (
                    <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all border-2 ${
                        idx === stepIdx ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 
                        idx < stepIdx ? 'bg-emerald-100 border-emerald-100 text-emerald-600' : 
                        'bg-slate-50 border-slate-200 text-slate-300'
                    }`}>
                        {idx < stepIdx ? <CheckCircle2 size={16} /> : idx + 1}
                    </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <h4 className="text-2xl font-black text-slate-800 tracking-tight">{syncStatus}</h4>
              <p className="text-slate-400 text-sm font-medium">Keep this page open during sync</p>
            </div>

            {/* CONDITIONAL RENDERING TO FORCE UNMOUNTING */}
            {syncStep === 'generating' && (
              <div className="py-12 animate-in zoom-in duration-300">
                <Loader2 size={64} className="animate-spin text-emerald-600 mx-auto" />
                <p className="text-xs text-slate-400 font-black uppercase tracking-widest mt-4">Bundling handshake signal...</p>
              </div>
            )}

            {syncStep === 'showing-qr' && qrData && (
              <div className="space-y-8 animate-in zoom-in duration-300">
                <div className="p-6 bg-white border-8 border-emerald-500 rounded-[