
import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  X, 
  Send, 
  CheckCheck, 
  PlayCircle, 
  Clock, 
  ExternalLink 
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { generateRequestCode } from '../utils/licensing';

const SupportChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  
  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const terminalId = generateRequestCode();
  const supportNumber = '2348184774884';

  const handleSend = () => {
    if (!message.trim()) return;
    
    const shopName = settings?.shop_name || 'NaijaShop Terminal';
    const autoContext = `[Shop: ${shopName} | ID: ${terminalId}]`;
    const fullMessage = `${message} ${autoContext}`;
    
    const whatsappUrl = `https://wa.me/${supportNumber}?text=${encodeURIComponent(fullMessage)}`;
    
    window.open(whatsappUrl, '_blank');
    
    // Status Simulation
    setIsSent(true);
    setShowStatus(true);
    setMessage('');

    // Clear status after 10 seconds
    setTimeout(() => {
      setShowStatus(false);
    }, 10000);
  };

  const openWhatsAppDirect = () => {
    window.open(`https://wa.me/${supportNumber}`, '_blank');
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[999] w-16 h-16 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-emerald-700 hover:scale-110 active:scale-95 transition-all animate-in fade-in zoom-in duration-500"
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
        {!isOpen && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 border-2 border-white rounded-full"></span>
        )}
      </button>

      {/* Chat Widget Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[999] w-[360px] max-w-[calc(100vw-3rem)] bg-white rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
          {/* Header Area */}
          <div className="bg-emerald-900 p-6 text-white relative overflow-hidden">
            <div className="absolute right-[-20px] top-[-20px] opacity-10">
              <MessageCircle size={120} />
            </div>
            
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                  <MessageCircle size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight">Support Guru</h3>
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Digital Assistant</p>
                </div>
              </div>

              <button 
                onClick={openWhatsAppDirect}
                className="w-full bg-emerald-800/50 hover:bg-emerald-800 border border-white/10 p-4 rounded-2xl transition-all text-center group"
              >
                <div className="flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest">
                  <PlayCircle size={16} className="text-emerald-400" />
                  Open WhatsApp Chat
                </div>
                <p className="text-[9px] text-emerald-300/80 mt-1 font-medium">
                  Replies will arrive in your WhatsApp app. Click here to check for messages.
                </p>
              </button>
            </div>
          </div>

          {/* Conversation Area */}
          <div className="flex-1 p-6 space-y-4 min-h-[150px] bg-slate-50/30">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-xs text-slate-600 leading-relaxed font-medium">
              👋 Welcome! How can we help you today? Type your request below and we'll reach out on WhatsApp.
            </div>

            {showStatus && (
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 animate-in zoom-in duration-300">
                <div className="flex items-center justify-center gap-2 text-emerald-600 mb-1">
                  <CheckCheck size={18} />
                  <span className="text-xs font-black uppercase tracking-widest">Message Sent</span>
                </div>
                <p className="text-[10px] text-center text-emerald-700/70 font-bold">
                  Message sent to Support. We usually reply within 10 minutes.
                </p>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-6 border-t border-slate-100 bg-white">
            <div className="relative mb-4">
              <textarea 
                placeholder="Type your question..."
                className="w-full p-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 min-h-[80px] font-medium resize-none transition-all"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button 
                onClick={handleSend}
                disabled={!message.trim()}
                className="absolute right-3 bottom-3 p-2 bg-emerald-600 text-white rounded-xl disabled:opacity-30 transition-all hover:bg-emerald-700 active:scale-90"
              >
                <Send size={18} />
              </button>
            </div>
            
            <div className="flex items-center justify-center gap-2 text-slate-400 border-t border-slate-50 pt-4">
              <Clock size={12} />
              <span className="text-[10px] font-black uppercase tracking-widest">Support Hours: 8am - 8pm Daily</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SupportChat;
