
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-NG'; // Optimized for Nigerian accent
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        if (event.error !== 'no-speech') {
          showToast('Mic error. Check permissions.', 'error');
        }
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        handleVoiceCommand(transcript);
      };

      recognitionRef.current = recognition;
    }
  }, [products]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    if (type === 'error' && navigator.vibrate) {
      navigator.vibrate(100);
    }
    setTimeout(() => setToast(null), 3000);
  };

  const handleVoiceCommand = (transcript: string) => {
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
      
      // Simple Fuzzy Match: Check for inclusion or startsWith
      // If multiple matches, we take the one with the most stock or shortest name (simplistic relevance)
      const matches = products.filter(p => 
        p.name.toLowerCase().includes(targetName) || 
        targetName.includes(p.name.toLowerCase())
      );

      if (matches.length > 0) {
        // Find best match: prioritize exact or highest stock
        const bestMatch = matches.sort((a, b) => b.stock_qty - a.stock_qty)[0];
        onAddToCart(bestMatch);
        showToast(`Voice Command: Adding ${bestMatch.name}`, 'success');
      } else {
        showToast(`Product "${targetName}" not found. Try again.`, 'error');
      }
    } else {
      showToast('Command not recognized. Try "Add [Product]"', 'error');
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        showToast('Voice not supported on this browser.', 'error');
        return;
      }
      recognitionRef.current.start();
    }
  };

  return (
    <div className="relative flex items-center">
      <button 
        onClick={toggleListening}
        className={`p-3 rounded-xl transition-all relative ${
          isListening 
            ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200' 
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }`}
        title={isListening ? 'Listening for commands...' : 'Start Voice Assistant'}
      >
        {isListening ? <Mic size={20} /> : <MicOff size={20} />}
        
        {isListening && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-3 py-1.5 rounded-lg whitespace-nowrap animate-in fade-in slide-in-from-bottom-2">
            Listening for commands...
          </div>
        )}
      </button>

      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[1000] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in zoom-in duration-300 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span className="font-black text-xs uppercase tracking-widest">{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default VoiceAssistant;
