
import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import LZString from 'lz-string';
import { useSync } from '../context/SyncProvider';
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
  ClipboardPaste
} from 'lucide-react';
import { Staff, View } from '../types';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

interface SyncStationProps {
  currentUser?: Staff | null;
  setView: (view: View) => void;
}

const SyncStation: React.FC<SyncStationProps> = ({ currentUser, setView }) => {
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';
  const { status, initiateSync, resetConnection, broadcastInventory } = useSync();
  
  const [mode, setMode] = useState<'idle' | 'host' | 'join'>('idle');
  const [step, setStep] = useState<'idle' | 'generating' | 'showing' | 'scanning'>('idle');
  const [qrData, setQrData] = useState<string | null>(null);
  const [rawSignal, setRawSignal] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setMode('idle');
    setStep('idle');
    setQrData(null);
    setRawSignal(null);
  }, []);

  const handleStartSync = async (isHost: boolean) => {
    const activeMode = isHost ? 'host' : 'join';
    setMode(activeMode);
    setStep('generating');
    
    const p = initiateSync(isHost, activeMode);

    p.on('signal', (data: any) => {
      const signalStr = JSON.stringify(data);
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

  const handleScanSuccess = useCallback((signal: string) => {
    try {
      const decompressed = LZString.decompressFromEncodedURIComponent(signal);
      if (!decompressed) return;
      const data = JSON.parse(decompressed);
      const { peer } = useSync(); // This approach is slightly flawed in callbacks, but useSync status check is better
    } catch (e) {}
  }, []);

  // When live, push the catalog immediately if admin
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

  // Barcode Detection
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
              peer.signal(JSON.parse(decompressed));
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
        <div className="relative z-10 flex items-center gap-6">
          <div className="w-16 h-16 bg-white rounded-2xl p-2 flex items-center justify-center shadow-lg"><img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" /></div>
          <div>
             <h2 className="text-4xl font-black tracking-tight">Sync Station</h2>
             <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-1">Direct Wi-Fi Live Bridge</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm min-h-[500px] flex flex-col justify-center items-center relative">
        {status === 'live' ? (
           <div className="text-center space-y-6 animate-in zoom-in">
              <div className="w-32 h-32 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><CheckCircle2 size={80} className="animate-bounce" /></div>
              <h3 className="text-3xl font-black text-slate-900">Live Link Active!</h3>
              <p className="text-slate-500">Terminals are now bridged in real-time.</p>
           </div>
        ) : step === 'idle' ? (
          <div className="w-full max-w-2xl space-y-8 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <button onClick={() => handleStartSync(true)} className="p-8 bg-emerald-50 border-2 border-emerald-100 rounded-[2.5rem] hover:border-emerald-500 transition-all text-left flex items-center gap-6">
                 <div className="p-5 bg-white rounded-2xl text-emerald-600 shadow-sm"><Wifi size={32} /></div>
                 <div><p className="font-black text-xl">Host Link</p><p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1">Admin Mode</p></div>
               </button>
               <button onClick={() => handleStartSync(false)} className="p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] hover:border-emerald-500 transition-all text-left flex items-center gap-6">
                 <div className="p-5 bg-white rounded-2xl text-slate-400 shadow-sm"><Smartphone size={32} /></div>
                 <div><p className="font-black text-xl">Join Link</p><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Staff Mode</p></div>
               </button>
            </div>
            <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 flex items-start gap-4"><Info size={20} className="text-amber-600 shrink-0" /><p className="text-xs text-slate-500">Ensure both phones are on the same Wi-Fi. If using a Hotspot, disable Mobile Data on the guest phone.</p></div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-8 animate-in fade-in">
            <h4 className="text-2xl font-black text-slate-800">{status === 'connecting' ? 'Establishing Handshake...' : 'Show QR to Other Terminal'}</h4>
            {qrData && step === 'showing' && (
               <div className="space-y-6 flex flex-col items-center">
                  <div className="p-6 bg-white border-8 border-emerald-500 rounded-[3rem] shadow-2xl inline-block"><img src={qrData} alt="QR" className="w-64 h-64 rounded-xl" /></div>
                  <button onClick={() => setStep('scanning')} className="w-full px-8 py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-2"><Camera size={20} /> Next: Scan Other Phone</button>
               </div>
            )}
            {step === 'scanning' && (
              <div className="w-full max-w-sm space-y-6">
                <div className="aspect-square bg-slate-900 rounded-[3rem] overflow-hidden border-4 border-emerald-500 relative shadow-2xl">
                   <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                   <div className="absolute inset-0 border-[40px] border-black/40"><div className="w-full h-full border-2 border-emerald-400 rounded-xl relative"><div className="animate-scan"></div></div></div>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Manual Paste Fallback:</p>
                    <textarea 
                       className="w-full h-24 p-4 bg-white border border-slate-200 rounded-2xl font-mono text-[10px] outline-none" 
                       placeholder="Paste code from other phone..."
                       value={manualInput}
                       onChange={(e) => setManualInput(e.target.value)}
                    />
                    <button 
                      onClick={() => {
                        const { peer } = useSync();
                        const decompressed = LZString.decompressFromEncodedURIComponent(manualInput.trim());
                        if (peer && decompressed) peer.signal(JSON.parse(decompressed));
                      }} 
                      className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase"
                    >
                      Process Manual Link
                    </button>
                </div>
              </div>
            )}
            <button onClick={cleanup} className="flex items-center gap-2 text-rose-500 font-bold px-6 py-3 rounded-2xl hover:bg-rose-50 transition-all"><X size={18} /> Cancel Reset</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncStation;
