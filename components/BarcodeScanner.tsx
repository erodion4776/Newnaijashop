import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Camera, 
  X, 
  Loader2, 
  ShieldAlert, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2,
  Flashlight,
  FlashlightOff,
  ZoomIn,
  ZoomOut,
  Keyboard,
  Barcode
} from 'lucide-react';

// TypeScript declaration for BarcodeDetector
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string; format: string }>>;
    };
  }
}

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

type ScannerState = 'idle' | 'initializing' | 'active' | 'success' | 'error' | 'manual';

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [state, setState] = useState<ScannerState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hasBarcodeAPI, setHasBarcodeAPI] = useState(false);

  // Check for BarcodeDetector support
  useEffect(() => {
    setHasBarcodeAPI('BarcodeDetector' in window);
  }, []);

  // Stop camera and cleanup
  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Toggle torch/flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    
    try {
      const capabilities = track.getCapabilities() as any;
      if (capabilities.torch) {
        const newTorchState = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: newTorchState } as any]
        });
        setTorchOn(newTorchState);
      }
    } catch (err) {
      console.warn('Torch not supported:', err);
    }
  };

  // Adjust zoom
  const adjustZoom = async (delta: number) => {
    if (!streamRef.current) return;
    
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    
    try {
      const capabilities = track.getCapabilities() as any;
      if (capabilities.zoom) {
        const newZoom = Math.max(capabilities.zoom.min, Math.min(capabilities.zoom.max, zoomLevel + delta));
        await track.applyConstraints({
          advanced: [{ zoom: newZoom } as any]
        });
        setZoomLevel(newZoom);
      }
    } catch (err) {
      console.warn('Zoom not supported:', err);
    }
  };

  // Start camera
  const startCamera = async () => {
    setState('initializing');
    setError(null);
    
    try {
      // Check secure context
      if (!window.isSecureContext) {
        throw new Error('Camera requires HTTPS. Please use a secure connection.');
      }

      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available on this device or browser.');
      }

      // Try back camera first, then fallback to any camera
      let stream: MediaStream;
      
      const constraints = [
        // Try exact environment (back) camera with ideal resolution
        {
          video: { 
            facingMode: { exact: 'environment' },
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 }
          }
        },
        // Fallback: prefer environment camera
        {
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        // Last resort: any camera
        { video: true }
      ];

      for (const constraint of constraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraint);
          break;
        } catch (e) {
          console.warn('Camera constraint failed:', constraint, e);
          continue;
        }
      }

      if (!stream!) {
        throw new Error('Could not access any camera on this device.');
      }

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current!;
          
          video.onloadedmetadata = async () => {
            try {
              await video.play();
              resolve();
            } catch (playError) {
              reject(playError);
            }
          };
          
          video.onerror = () => reject(new Error('Video stream error'));
          
          // Timeout after 10 seconds
          setTimeout(() => reject(new Error('Camera initialization timeout')), 10000);
        });
        
        setState('active');
        startBarcodeDetection();
      }
    } catch (err: any) {
      console.error("Camera Error:", err);
      stopCamera();
      
      let msg = 'Camera error. Please check permissions.';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera access denied. Please allow camera permission in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera is in use by another application.';
      } else if (err.name === 'OverconstrainedError') {
        msg = 'Camera does not meet requirements.';
      } else if (err.message) {
        msg = err.message;
      }
      
      setError(msg);
      setState('error');
    }
  };

  // Start barcode detection
  const startBarcodeDetection = () => {
    if (!hasBarcodeAPI) {
      console.warn('BarcodeDetector not supported. Using manual fallback.');
      return;
    }

    const detector = new window.BarcodeDetector!({
      formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e', 'codabar', 'itf']
    });

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      
      try {
        const barcodes = await detector.detect(videoRef.current);
        
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          handleSuccessfulScan(code);
        }
      } catch (e) {
        // Detection might fail during frame transitions - ignore
      }
    }, 200);
  };

  // Handle successful scan
  const handleSuccessfulScan = (code: string) => {
    // Clear interval immediately
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([50, 50, 100]);
    }
    
    // Play success sound (optional)
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'+Array(300).join('A'));
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (e) {}
    
    setScannedCode(code);
    setState('success');
    
    // Auto-submit after brief delay
    setTimeout(() => {
      stopCamera();
      onScan(code);
      onClose();
    }, 1500);
  };

  // Handle manual input
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualInput.trim();
    if (code) {
      onScan(code);
      onClose();
    }
  };

  // Handle close
  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950 flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600/20 rounded-xl">
            <Barcode size={20} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Barcode Scanner</h3>
            <p className="text-[10px] text-slate-400">
              {!hasBarcodeAPI ? 'Manual entry mode' : 'Point camera at barcode'}
            </p>
          </div>
        </div>
        <button 
          onClick={handleClose}
          className="p-2 hover:bg-slate-800 rounded-xl transition-colors"
          aria-label="Close scanner"
        >
          <X size={24} className="text-slate-400" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          
          {/* Idle State - Start Button */}
          {state === 'idle' && (
            <div className="bg-slate-900 rounded-3xl p-8 text-center space-y-6 animate-in zoom-in">
              <div className="w-24 h-24 bg-emerald-600/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                <Camera size={48} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white">Ready to Scan</h3>
                <p className="text-slate-400 text-sm">
                  {hasBarcodeAPI 
                    ? 'Tap below to activate your camera and scan product barcodes.'
                    : 'Barcode scanning not supported on this browser. You can enter codes manually.'
                  }
                </p>
              </div>
              
              <div className="space-y-3">
                {hasBarcodeAPI && (
                  <button 
                    onClick={startCamera}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Camera size={22} />
                    Start Camera
                  </button>
                )}
                
                <button 
                  onClick={() => setState('manual')}
                  className="w-full py-3 bg-slate-800 text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  <Keyboard size={18} />
                  Enter Manually
                </button>
              </div>
            </div>
          )}

          {/* Initializing State */}
          {state === 'initializing' && (
            <div className="bg-slate-900 rounded-3xl p-8 text-center space-y-6 animate-in zoom-in">
              <div className="w-24 h-24 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mx-auto">
                <Loader2 size={48} className="animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Starting Camera</h3>
                <p className="text-slate-400 text-sm">Please allow camera access when prompted...</p>
              </div>
            </div>
          )}

          {/* Active Scanning State */}
          {state === 'active' && (
            <div className="relative aspect-[3/4] bg-slate-900 rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />
              
              {/* Scan Frame Overlay */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Dark overlay with transparent center */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-64 h-40">
                    {/* Corner markers */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-lg" />
                    
                    {/* Scanning line animation */}
                    <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-scan-line" />
                  </div>
                </div>
                
                {/* Instruction */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2">
                  <div className="bg-slate-900/80 backdrop-blur-sm text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    Align barcode in frame
                  </div>
                </div>
              </div>
              
              {/* Controls */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                {/* Torch Button */}
                <button
                  onClick={toggleTorch}
                  className={`p-3 rounded-full transition-all ${
                    torchOn 
                      ? 'bg-yellow-500 text-slate-900' 
                      : 'bg-slate-900/80 text-white hover:bg-slate-800'
                  }`}
                  aria-label={torchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
                >
                  {torchOn ? <FlashlightOff size={20} /> : <Flashlight size={20} />}
                </button>
                
                {/* Searching indicator */}
                <div className="bg-slate-900/80 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-emerald-500" />
                  <span className="text-xs font-bold text-white">Searching...</span>
                </div>
                
                {/* Zoom Controls */}
                <div className="flex items-center gap-1 bg-slate-900/80 rounded-full p-1">
                  <button
                    onClick={() => adjustZoom(-0.5)}
                    className="p-2 text-white hover:bg-slate-700 rounded-full transition-colors"
                    aria-label="Zoom out"
                  >
                    <ZoomOut size={18} />
                  </button>
                  <button
                    onClick={() => adjustZoom(0.5)}
                    className="p-2 text-white hover:bg-slate-700 rounded-full transition-colors"
                    aria-label="Zoom in"
                  >
                    <ZoomIn size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Success State */}
          {state === 'success' && scannedCode && (
            <div className="bg-emerald-900 rounded-3xl p-8 text-center space-y-6 animate-in zoom-in">
              <div className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 size={56} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-black text-white">Barcode Detected!</h3>
                <div className="bg-emerald-950/50 p-4 rounded-2xl border border-emerald-700">
                  <p className="text-2xl font-mono font-bold text-emerald-300 tracking-wider">
                    {scannedCode}
                  </p>
                </div>
                <p className="text-emerald-300 text-sm">Adding to cart...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {state === 'error' && (
            <div className="bg-slate-900 rounded-3xl p-8 text-center space-y-6 animate-in zoom-in">
              <div className="w-24 h-24 bg-rose-600/20 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert size={48} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-black text-white">Camera Error</h3>
                <div className="bg-rose-950/30 p-4 rounded-2xl border border-rose-800/50">
                  <p className="text-rose-200 text-sm">{error}</p>
                </div>
              </div>
              <div className="space-y-3">
                <button 
                  onClick={startCamera}
                  className="w-full py-4 bg-white text-slate-900 rounded-2xl font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <RefreshCw size={20} />
                  Try Again
                </button>
                <button 
                  onClick={() => setState('manual')}
                  className="w-full py-3 bg-slate-800 text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  <Keyboard size={18} />
                  Enter Manually Instead
                </button>
              </div>
            </div>
          )}

          {/* Manual Entry State */}
          {state === 'manual' && (
            <div className="bg-slate-900 rounded-3xl p-8 space-y-6 animate-in zoom-in">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  <Keyboard size={32} />
                </div>
                <h3 className="text-xl font-black text-white">Manual Entry</h3>
                <p className="text-slate-400 text-sm">Type or paste the barcode number</p>
              </div>
              
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter barcode..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  autoFocus
                  className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-white text-center text-xl font-mono tracking-widest placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                
                <button 
                  type="submit"
                  disabled={!manualInput.trim()}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 size={20} />
                  Add Product
                </button>
              </form>
              
              {hasBarcodeAPI && (
                <button 
                  onClick={() => {
                    setState('idle');
                    setManualInput('');
                  }}
                  className="w-full py-3 text-slate-400 font-bold text-sm hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <Camera size={16} />
                  Use Camera Instead
                </button>
              )}
            </div>
          )}
          
        </div>
      </div>

      {/* Footer - Only show when active or idle */}
      {(state === 'active' || state === 'idle') && (
        <div className="px-4 py-4 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between">
          <button 
            onClick={handleClose}
            className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-all"
          >
            Cancel
          </button>
          
          {state === 'active' && (
            <button 
              onClick={() => {
                stopCamera();
                setState('manual');
              }}
              className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-all flex items-center gap-2"
            >
              <Keyboard size={16} />
              Enter Manually
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;
