
import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, Loader2, ShieldAlert, RefreshCw, AlertCircle } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setIsInitializing(true);
    setError(null);
    
    try {
      // 1. Check if we are in a secure context (HTTPS)
      if (!window.isSecureContext) {
        throw new Error('Camera access requires a secure connection (HTTPS).');
      }

      // 2. Try exact environment (back) camera first
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: { exact: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch (e) {
        // 3. Fallback to general environment preference (some older devices or browsers)
        console.warn("Exact environment camera failed, trying general environment mode", e);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Ensure video is ready before setting started state
        videoRef.current.onloadedmetadata = () => {
          setHasStarted(true);
          setIsInitializing(false);
        };
      }
    } catch (err: any) {
      console.error("Camera Error:", err);
      let msg = 'Camera error. Please ensure you have given permission.';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera blocked. Please allow camera access in your browser settings and ensure you are using HTTPS.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No back camera found on this device.';
      } else if (err.message.includes('secure connection')) {
        msg = err.message;
      }
      
      setError(msg);
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    // Detect barcodes using native API if available
    let interval: any;
    if (hasStarted && 'BarcodeDetector' in window) {
      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a']
      });

      interval = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState !== 4) return;
        try {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            // Provide haptic feedback if available
            if (navigator.vibrate) navigator.vibrate(100);
            onScan(code);
            stopCamera();
            onClose();
          }
        } catch (e) {
          // Frame capture might fail during transitions, ignore
        }
      }, 300);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [hasStarted, onScan, onClose]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setHasStarted(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="fixed inset-0 z-[300] bg-black/95 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-md relative aspect-[3/4] bg-slate-900 rounded-[3rem] overflow-hidden border-4 border-slate-800 shadow-2xl flex flex-col items-center justify-center">
        {!hasStarted && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 space-y-6">
            <div className="w-20 h-20 bg-emerald-600/20 text-emerald-500 rounded-full flex items-center justify-center">
              <Camera size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white">Terminal Scanner</h3>
              <p className="text-slate-400 text-sm">Ready to scan product barcodes. Tap below to activate your back camera.</p>
            </div>
            <button 
              onClick={startCamera}
              disabled={isInitializing}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isInitializing ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  Initializing...
                </>
              ) : (
                <>
                  <RefreshCw size={20} />
                  Start Scanner
                </>
              )}
            </button>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 space-y-6 bg-rose-950/20">
            <div className="w-20 h-20 bg-rose-600/20 text-rose-500 rounded-full flex items-center justify-center">
              <ShieldAlert size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white">Scanner Interrupted</h3>
              <div className="bg-rose-500/10 p-4 rounded-xl border border-rose-500/20">
                <p className="text-rose-200/80 text-xs font-medium leading-relaxed">{error}</p>
              </div>
            </div>
            <div className="w-full space-y-3">
              <button 
                onClick={startCamera}
                className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-lg hover:bg-slate-100 transition-all active:scale-95"
              >
                Request Permission Again
              </button>
              <button 
                onClick={onClose}
                className="w-full py-3 text-slate-400 font-bold text-sm uppercase tracking-widest"
              >
                Cancel Scanning
              </button>
            </div>
          </div>
        )}

        {hasStarted && (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-48 border-2 border-emerald-500 rounded-2xl relative shadow-[0_0_0_2000px_rgba(0,0,0,0.7)]">
                <div className="animate-scan"></div>
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap shadow-lg">
                  Align Barcode Inside Frame
                </div>
              </div>
            </div>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
               <AlertCircle size={14} className="text-emerald-400" />
               <span className="text-[9px] font-black text-white uppercase tracking-widest">Searching for barcodes...</span>
            </div>
          </>
        )}
      </div>

      <button 
        onClick={onClose}
        className="mt-8 p-5 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 transition-all active:scale-95 border border-white/5"
      >
        <X size={32} />
      </button>

      <div className="mt-6 text-center">
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">NaijaShop PWA Scanner v2.1</p>
      </div>
    </div>
  );
};

export default BarcodeScanner;
