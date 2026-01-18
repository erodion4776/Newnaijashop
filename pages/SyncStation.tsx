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
  ShieldCheck,
  SmartphoneNfc,
  Users,
  QrCode
} from 'lucide-react';
import { Staff, View } from '../types';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

interface SyncStationProps {
  currentUser?: Staff | null;
  setView: (view: View) => void;
}

// Define all possible steps in the sync flow
type SyncStep = 
  | 'idle' 
  | 'generating' 
  | 'host_showing_offer'      // Host shows QR with offer
  | 'host_scanning_answer'    // Host scans Staff's answer QR
  | 'staff_scanning_offer'    // Staff scans Host's offer QR
  | 'staff_showing_answer'    // Staff shows QR with answer
  | 'connecting'              // Both sides have exchanged, connecting...
  | 'whatsapp';

const SyncStation: React.FC<SyncStationProps> = ({ currentUser, setView }) => {
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';
  const { status, initiateSync, resetConnection, broadcastInventory, sessionId, processWhatsAppSync } = useSync();
  
  const [step, setStep] = useState<SyncStep>('idle');
  const [qrData, setQrData] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<any>(null);
  const isSyncingRef = useRef(false);
  const scannedSessionIdRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    peerRef.current = null;
    resetConnection();
    setStep('idle');
    setQrData(null);
    setStatusMessage('');
    isSyncingRef.current = false;
    scannedSessionIdRef.current = null;
  }, [resetConnection]);

  // HOST (Admin/Boss) starts the sync
  const handleHostStart = async () => {
    cleanup();
    setStep('generating');
    setStatusMessage('Generating secure handshake...');
    
    // Create peer as INITIATOR (host)
    const peer = initiateSync(true);
    peerRef.current = peer;

    peer.on('signal', (data: any) => {
      // First signal from host is the OFFER
      if (data.type === 'offer' || !scannedSessionIdRef.current) {
        const payload = { 
          type: 'offer',
          sessionId, 
          signal: data 
        };
        const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
        QRCode.toDataURL(compressed, { margin: 1, scale: 8, errorCorrectionLevel: 'L' }, (err, url) => {
          if (!err) { 
            setQrData(url); 
            setStep('host_showing_offer');
            setStatusMessage('Show this QR to Staff device');
          }
        });
      }
    });

    peer.on('connect', () => {
      setStatusMessage('Connected! Syncing data...');
    });

    peer.on('error', (err: any) => {
      console.error('Peer error:', err);
      setStatusMessage('Connection error. Please try again.');
    });
  };

  // STAFF starts the sync
  const handleStaffStart = async () => {
    cleanup();
    setStep('staff_scanning_offer');
    setStatusMessage('Point camera at Admin\'s QR code');
  };

  // Process scanned QR data
  const processScannedQR = useCallback((rawValue: string) => {
    if (isSyncingRef.current) return;
    
    try {
      const decompressed = LZString.decompressFromEncodedURIComponent(rawValue);
      if (!decompressed) return;
      
      const payload = JSON.parse(decompressed);
      
      // STAFF scanned HOST's OFFER
      if (payload.type === 'offer' && step === 'staff_scanning_offer') {
        isSyncingRef.current = true;
        scannedSessionIdRef.current = payload.sessionId;
        setStatusMessage('Offer received! Generating response...');
        
        // Stop camera
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        
        // Create peer as NON-INITIATOR (joiner)
        const peer = initiateSync(false);
        peerRef.current = peer;
        
        peer.on('signal', (data: any) => {
          // This will be the ANSWER signal
          const answerPayload = { 
            type: 'answer',
            sessionId: payload.sessionId, 
            signal: data 
          };
          const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(answerPayload));
          QRCode.toDataURL(compressed, { margin: 1, scale: 8, errorCorrectionLevel: 'L' }, (err, url) => {
            if (!err) { 
              setQrData(url); 
              setStep('staff_showing_answer');
              setStatusMessage('Show this QR to Admin device');
            }
          });
        });

        peer.on('connect', () => {
          setStatusMessage('Connected! Receiving data...');
        });

        peer.on('error', (err: any) => {
          console.error('Peer error:', err);
          setStatusMessage('Connection error. Please try again.');
        });
        
        // Feed the host's offer signal to our peer
        peer.signal(payload.signal);
      }
      
      // HOST scanned STAFF's ANSWER
      if (payload.type === 'answer' && step === 'host_scanning_answer') {
        if (peerRef.current && payload.sessionId === sessionId) {
          isSyncingRef.current = true;
          setStatusMessage('Answer received! Establishing connection...');
          setStep('connecting');
          
          // Stop camera
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
          }
          
          // Feed the staff's answer signal to our peer
          peerRef.current.signal(payload.signal);
        }
      }
    } catch (e) {
      console.error('QR Parse Error:', e);
    }
  }, [step, sessionId, initiateSync]);

  // Host transitions to scanning mode after showing their QR
  const hostStartScanning = () => {
    setQrData(null);
    setStep('host_scanning_answer');
    setStatusMessage('Scan Staff\'s response QR code');
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

  // Handle successful connection
  useEffect(() => {
    if (status === 'live') {
      if (isAdmin) broadcastInventory();
      setTimeout(() => setView('dashboard'), 2000);
    }
  }, [status, isAdmin, broadcastInventory, setView]);

  // Camera initialization for scanning steps
  useEffect(() => {
    const needsCamera = step === 'staff_scanning_offer' || step === 'host_scanning_answer';
    
    if (needsCamera) {
      const initCamera = async () => {
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
          console.error('Camera error:', err);
          setStatusMessage('Camera access denied. Please enable camera permissions.');
        }
      };
      initCamera();
    }
    
    return () => { 
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [step]);

  // QR Scanning Logic
  useEffect(() => {
    let interval: any;
    const needsScanning = step === 'staff_scanning_offer' || step === 'host_scanning_answer';
    
    if (needsScanning && 'BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      
      interval = setInterval(async () => {
        if (!videoRef.current || isSyncingRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            processScannedQR(codes[0].rawValue);
          }
        } catch (e) {
          // Ignore detection errors
        }
      }, 300);
    }
    
    return () => clearInterval(interval);
  }, [step, processScannedQR]);

  const renderContent = () => {
    // Connected state
    if (status === 'live') {
      return (
        <div className="text-center space-y-6 animate-in zoom-in">
          <div className="w-32 h-32 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 size={80} className="animate-bounce" />
          </div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tight">Terminal Linked!</h3>
          <p className="text-slate-500 font-medium">Auto-pushing data... please stay on this screen.</p>
        </div>
      );
    }

    // Idle - Role Selection
    if (step === 'idle') {
      return (
        <div className="w-full max-w-2xl space-y-10 animate-in fade-in">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Identify Your Terminal</h3>
            <p className="text-slate-500 text-sm">Select your role to establish a Wi-Fi or WhatsApp link.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button 
              onClick={handleHostStart} 
              className="group p-8 bg-emerald-50 border-2 border-emerald-100 rounded-[2.5rem] hover:border-emerald-500 transition-all text-left flex items-center gap-6 shadow-sm"
            >
              <div className="p-5 bg-white rounded-2xl text-emerald-600 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <ShieldCheck size={32} />
              </div>
              <div>
                <p className="font-black text-xl">I am the Boss</p>
                <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1">Host Wi-Fi Sync</p>
              </div>
            </button>
            <button 
              onClick={handleStaffStart} 
              className="group p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] hover:border-emerald-500 transition-all text-left flex items-center gap-6 shadow-sm"
            >
              <div className="p-5 bg-white rounded-2xl text-slate-400 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <SmartphoneNfc size={32} />
              </div>
              <div>
                <p className="font-black text-xl">I am Staff</p>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Join Shop Sync</p>
              </div>
            </button>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-center">
            <button 
              onClick={() => setStep('whatsapp')} 
              className="flex items-center gap-3 px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:border-emerald-500 transition-all text-xs font-black uppercase tracking-widest"
            >
              <MessageSquare size={16} className="text-emerald-600" /> Use WhatsApp Fallback Sync
            </button>
          </div>
        </div>
      );
    }

    // WhatsApp fallback
    if (step === 'whatsapp') {
      return (
        <div className="w-full max-w-lg space-y-8 animate-in zoom-in">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">WhatsApp Data Bridge</h3>
          </div>
          <div className="space-y-6">
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 text-center space-y-4">
              <p className="text-sm font-bold text-slate-600">Export data as a compressed string.</p>
              <button 
                onClick={handleWhatsAppExport} 
                disabled={isProcessing} 
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Share2 size={18} /> Export Data
              </button>
            </div>
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 space-y-4">
              <textarea 
                className="w-full h-32 p-4 bg-white border border-slate-200 rounded-2xl font-mono text-[10px]" 
                placeholder="Paste WhatsApp data here..." 
                value={manualInput} 
                onChange={(e) => setManualInput(e.target.value)} 
              />
              <button 
                onClick={handleWhatsAppImport} 
                disabled={isProcessing || !manualInput} 
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black active:scale-95 flex items-center justify-center gap-2"
              >
                <ClipboardPaste size={18} /> Process Import
              </button>
            </div>
          </div>
          <button 
            onClick={() => setStep('idle')} 
            className="w-full py-2 text-slate-400 font-black text-xs uppercase tracking-widest"
          >
            Back to Selection
          </button>
        </div>
      );
    }

    // Generating state
    if (step === 'generating') {
      return (
        <div className="text-center space-y-6">
          <Loader2 size={64} className="animate-spin text-emerald-600 mx-auto" />
          <p className="text-slate-600 font-medium">{statusMessage}</p>
        </div>
      );
    }

    // HOST showing their offer QR
    if (step === 'host_showing_offer') {
      return (
        <div className="w-full flex flex-col items-center gap-8 animate-in fade-in">
          <div className="text-center space-y-2">
            <h4 className="text-2xl font-black text-slate-800 tracking-tight">Step 1: Staff Scans This</h4>
            <p className="text-slate-500">{statusMessage}</p>
          </div>
          
          {qrData && (
            <div className="p-6 bg-white border-8 border-emerald-500 rounded-[3rem] shadow-2xl inline-block relative overflow-hidden">
              <img src={qrData} alt="Offer QR" className="w-64 h-64 rounded-xl" />
              <div className="absolute inset-0 bg-emerald-600/10 animate-pulse pointer-events-none" />
            </div>
          )}
          
          <button 
            onClick={hostStartScanning}
            className="px-8 py-4 bg-emerald-600 text-white rounded-xl font-black uppercase text-sm tracking-widest flex items-center gap-2"
          >
            <Camera size={20} /> Staff Scanned? Click to Continue
          </button>
          
          <button 
            onClick={cleanup} 
            className="px-8 py-3 bg-rose-50 text-rose-600 rounded-xl font-black uppercase text-xs tracking-widest border border-rose-100"
          >
            Cancel & Reset
          </button>
        </div>
      );
    }

    // HOST scanning staff's answer QR
    if (step === 'host_scanning_answer') {
      return (
        <div className="w-full flex flex-col items-center gap-8 animate-in fade-in">
          <div className="text-center space-y-2">
            <h4 className="text-2xl font-black text-slate-800 tracking-tight">Step 2: Scan Staff's Response</h4>
            <p className="text-slate-500">{statusMessage}</p>
          </div>
          
          <div className="w-full max-w-sm aspect-square bg-slate-900 rounded-[3rem] overflow-hidden border-4 border-emerald-500 relative shadow-2xl">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
            <div className="absolute inset-0 border-[40px] border-black/40">
              <div className="w-full h-full border-2 border-emerald-400 rounded-xl relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400 animate-scan-line" />
              </div>
            </div>
          </div>
          
          <button 
            onClick={cleanup} 
            className="px-8 py-3 bg-rose-50 text-rose-600 rounded-xl font-black uppercase text-xs tracking-widest border border-rose-100"
          >
            Cancel & Reset
          </button>
        </div>
      );
    }

    // STAFF scanning host's offer QR
    if (step === 'staff_scanning_offer') {
      return (
        <div className="w-full flex flex-col items-center gap-8 animate-in fade-in">
          <div className="text-center space-y-2">
            <h4 className="text-2xl font-black text-slate-800 tracking-tight">Step 1: Scan Admin's QR</h4>
            <p className="text-slate-500">{statusMessage}</p>
          </div>
          
          <div className="w-full max-w-sm aspect-square bg-slate-900 rounded-[3rem] overflow-hidden border-4 border-blue-500 relative shadow-2xl">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
            <div className="absolute inset-0 border-[40px] border-black/40">
              <div className="w-full h-full border-2 border-blue-400 rounded-xl relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400 animate-scan-line" />
              </div>
            </div>
          </div>
          
          <button 
            onClick={cleanup} 
            className="px-8 py-3 bg-rose-50 text-rose-600 rounded-xl font-black uppercase text-xs tracking-widest border border-rose-100"
          >
            Cancel & Reset
          </button>
        </div>
      );
    }

    // STAFF showing their answer QR
    if (step === 'staff_showing_answer') {
      return (
        <div className="w-full flex flex-col items-center gap-8 animate-in fade-in">
          <div className="text-center space-y-2">
            <h4 className="text-2xl font-black text-slate-800 tracking-tight">Step 2: Admin Scans This</h4>
            <p className="text-slate-500">{statusMessage}</p>
          </div>
          
          {qrData && (
            <div className="p-6 bg-white border-8 border-blue-500 rounded-[3rem] shadow-2xl inline-block relative overflow-hidden">
              <img src={qrData} alt="Answer QR" className="w-64 h-64 rounded-xl" />
              <div className="absolute inset-0 bg-blue-600/10 animate-pulse pointer-events-none" />
            </div>
          )}
          
          <div className="text-center text-slate-500 text-sm">
            <p>Keep this screen visible until connection is established</p>
          </div>
          
          <button 
            onClick={cleanup} 
            className="px-8 py-3 bg-rose-50 text-rose-600 rounded-xl font-black uppercase text-xs tracking-widest border border-rose-100"
          >
            Cancel & Reset
          </button>
        </div>
      );
    }

    // Connecting state
    if (step === 'connecting') {
      return (
        <div className="text-center space-y-6 animate-in fade-in">
          <Loader2 size={64} className="animate-spin text-emerald-600 mx-auto" />
          <h4 className="text-xl font-bold text-slate-800">{statusMessage}</h4>
          <p className="text-slate-500">Please wait while the secure connection is established...</p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="bg-emerald-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-[-40px] bottom-[-40px] opacity-10">
          <ArrowRightLeft size={240} />
        </div>
        <div className="relative z-10 flex items-center gap-6">
          <div className="w-16 h-16 bg-white rounded-2xl p-2 flex items-center justify-center">
            <img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
          </div>
          <div>
            <h2 className="text-4xl font-black tracking-tight">Sync Station</h2>
            <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-1">
              Terminal Data Bridge
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm min-h-[500px] flex flex-col items-center justify-center relative">
        {renderContent()}
      </div>

      {/* Instructions Panel */}
      {step !== 'idle' && step !== 'whatsapp' && status !== 'live' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h4 className="font-bold text-amber-800 flex items-center gap-2 mb-3">
            <Info size={18} /> Sync Instructions
          </h4>
          <ol className="text-sm text-amber-700 space-y-2 list-decimal list-inside">
            <li><strong>Boss/Admin:</strong> Shows QR code first, then scans Staff's response</li>
            <li><strong>Staff:</strong> Scans Boss's QR code, then shows their response QR</li>
            <li>Both devices must complete the exchange for connection to work</li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default SyncStation;