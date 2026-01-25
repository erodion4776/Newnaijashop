
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, AlertCircle, CheckCircle2, RefreshCw, Info, Lock } from 'lucide-react';
import { Product } from '../types';

interface VoiceAssistantProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  onParkOrder: () => void;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ 
  products, 
  onAddToCart, 
  onClearCart, 
  onCheckout, 
  onParkOrder 
}) => {
  const [isListening, setIsListening] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [errorType, setErrorType] = useState<'permission' | 'blocked' | 'network' | null>(null);
  const recognitionRef = useRef<any>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    if (type === 'error' && navigator.vibrate) {
      navigator.vibrate(100);
    }
    setTimeout(() => setToast(null), 4000);
  };

  const handleVoiceCommand = useCallback((transcript: string) => {
    console.log('Voice Command:', transcript);

    if (transcript.includes('clear cart')) {
      onClearCart();
      showToast('Voice Command: Cart Cleared', 'success');
    } else if (transcript.includes('checkout')) {
      onCheckout();
      showToast('Voice Command: Opening Checkout', 'success');
    } else if (transcript.includes('park order')) {
      onParkOrder();
      showToast('Voice Command: Parking Order', 'success');
    } else if (transcript.startsWith('add ')) {
      const targetName = transcript.replace('add ', '').trim();
      
      const matches = products.filter(p => 
        p.name.toLowerCase().includes(targetName) || 
        targetName.includes(p.name.toLowerCase())
      );

      if (matches.length > 0) {
        const bestMatch = matches.sort((a, b) => b.stock_qty - a.stock_qty)[0];
        onAddToCart(bestMatch);
        showToast(`Voice Command: Adding ${bestMatch.name}`, 'success');
      } else {
        showToast(`Product "${targetName}" not found. Try again.`, 'error');
      }
    } else {
      showToast('Command not recognized. Try "Add [Product]"', 'error');
    }
  }, [products, onAddToCart, onClearCart, onCheckout, onParkOrder]);

  const initRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-NG';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setErrorType(null);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Ensure the mic is actually released
      try {
        recognition.stop();
      } catch (e) {
        // Already stopped
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
      try {
        recognition.stop();
      } catch (e) {}

      if (event.error === 'not-allowed') {
        setErrorType('blocked');
      } else if (event.error === 'network') {
        setErrorType('network');
      } else if (event.error !== 'no-speech') {
        showToast('Mic error. Please try again.', 'error');
      }
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      // Explicitly stop to handle non-continuous mode cleanup
      try {
        recognition.stop();
      } catch (e) {}
      handleVoiceCommand(transcript);
    };

    return recognition;
  }, [handleVoiceCommand]);

  useEffect(() => {
    recognitionRef.current = initRecognition();
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [initRecognition]);

  const checkPermission = async () => {
    try {
      // Permissions API is not supported in all browsers for 'microphone'
      if (navigator.permissions && (navigator.permissions as any).query) {
        const result = await (navigator.permissions as any).query({ name: 'microphone' });
        if (result.state === 'denied') {
          setErrorType('blocked');
          return false;
        } else if (result.state === 'prompt') {
          showToast('Mic Access Required: Please click "Allow" when the browser asks.', 'info');
        }
      }
    } catch (e) {
      console.warn('Permissions API not supported for mic query');
    }
    return true;
  };

  const toggleListening = async () => {
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (e) {}
      return;
    }

    const canAttempt = await checkPermission();
    if (!canAttempt) return;

    if (!recognitionRef.current) {
      recognitionRef.current = initRecognition();
    }

    try {
      recognitionRef.current?.start();
    } catch (e) {
      console.error('Failed to start recognition', e);
      // Edge case: if it was already "starting", stop it and try again
      try {
        recognitionRef.current?.stop();
      } catch (err) {}
      setTimeout(() => {
        try {
          recognitionRef.current?.start();
        } catch (err) {
          showToast('Mic is busy. Please reset.', 'error');
        }
      }, 200);
    }
  };

  const resetMic = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setErrorType(null);
    setIsListening(false);
    recognitionRef.current = initRecognition();
    showToast('Mic Reset. Try again.', 'info');
  };

  return (
    <div className="relative flex items-center group">
      <button 
        onClick={toggleListening}
        className={`p-3 rounded-xl transition-all relative ${
          isListening 
            ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200' 
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }`}
        title={isListening ? 'Listening...' : 'Start Voice Assistant'}
      >
        {isListening ? <Mic size={20} /> : <MicOff size={20} />}
        
        {isListening && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-3 py-1.5 rounded-lg whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 z-50 shadow-2xl">
            Listening for commands...
          </div>
        )}
      </button>

      {/* Error Recovery UI */}
      {errorType && (
        <div className="absolute top-16 right-0 w-64 bg-white p-6 rounded-[2.5rem] shadow-2xl border border-slate-100 z-[1000] animate-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
              {errorType === 'blocked' ? <Lock size={28} /> : <AlertCircle size={28} />}
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-xs uppercase tracking-widest text-slate-900">
                {errorType === 'blocked' ? 'Mic Access Blocked' : 'Connection Error'}
              </h4>
              <p className="text-[10px] font-medium text-slate-500 leading-relaxed">
                {errorType === 'blocked' 
                  ? 'Oga, your mic is blocked. Click the "Lock" icon in the address bar and set Microphone to "Allow".' 
                  : 'Voice commands work best with a stable local connection.'}
              </p>
            </div>
            <button 
              onClick={resetMic}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all"
            >
              <RefreshCw size={14} /> Reset Mic
            </button>
          </div>
        </div>
      )}

      {/* Standalone Optimization Tooltip */}
      {!isListening && !errorType && (
        <div className="hidden group-hover:block absolute -top-14 right-0 bg-emerald-900 text-white text-[9px] px-3 py-2 rounded-xl whitespace-nowrap shadow-xl z-50 border border-white/10 animate-in fade-in slide-in-from-bottom-1">
          <p className="font-black uppercase tracking-widest mb-1">Oga Tip:</p>
          <p className="font-medium">Install to Home Screen for best results.</p>
        </div>
      )}

      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[1100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in zoom-in duration-300 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 
          toast.type === 'info' ? 'bg-indigo-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : 
           toast.type === 'info' ? <Info size={18} /> : <AlertCircle size={18} />}
          <span className="font-black text-xs uppercase tracking-widest">{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default VoiceAssistant;
