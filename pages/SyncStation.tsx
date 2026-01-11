
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db/db';
import { exportFullDatabase, importDatabaseFromString, shareToWhatsApp } from '../utils/backup';
import QRCode from 'qrcode';
import { 
  Wifi, 
  WifiOff, 
  QrCode, 
  Smartphone, 
  Share2, 
  Download, 
  Zap, 
  ShieldCheck, 
  Loader2, 
  X,
  Camera,
  MessageCircle,
  RefreshCw
} from 'lucide-react';

const SyncStation: React.FC = () => {
  const [mode, setMode] = useState<'idle' | 'host' | 'join'>('idle');
  const [qrData, setQrData] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('Ready for Zero-Data Sync');
  const [connectionState, setConnectionState] = useState<string>('disconnected');

  // WebRTC Refs
  const pc = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);

  const cleanup = () => {
    dataChannel.current?.close();
    pc.current?.close();
    setMode('idle');
    setQrData(null);
    setIsProcessing(false);
    setSyncStatus('Ready for Zero-Data Sync');
  };

  const setupWebRTC = () => {
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    pc.current = new RTCPeerConnection(config);

    pc.current.oniceconnectionstatechange = () => {
      setConnectionState(pc.current?.iceConnectionState || 'disconnected');
    };

    return pc.current;
  };

  const startHosting = async () => {
    setMode('host');
    setIsProcessing(true);
    setSyncStatus('Generating Offer...');

    const peer = setupWebRTC();
    dataChannel.current = peer.createDataChannel('sync-channel');
    
    dataChannel.current.onopen = async () => {
      setSyncStatus('Connected! Sending Data...');
      const backup = await exportFullDatabase();
      dataChannel.current?.send(backup);
      setSyncStatus('Sync Complete!');
      setTimeout(cleanup, 3000);
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    // For local sync, we gather ICE candidates then generate QR
    // In a real local environment, "host" candidates are gathered quickly.
    peer.onicecandidate = (event) => {
      if (!event.candidate) {
        // Gathering finished, generate QR
        const signal = JSON.stringify(peer.localDescription);
        QRCode.toDataURL(signal, { margin: 2, scale: 8 }, (err, url) => {
          setQrData(url);
          setIsProcessing(false);
          setSyncStatus('Scan this QR on the second device');
        });
      }
    };
  };

  const startJoining = () => {
    setMode('join');
    setSyncStatus('Waiting for Offer QR...');
  };

  const handleScanOffer = async (scannedSignal: string) => {
    setIsProcessing(true);
    setSyncStatus('Processing Offer...');
    
    const peer = setupWebRTC();
    
    peer.ondatachannel = (event) => {
      dataChannel.current = event.channel;
      dataChannel.current.onmessage = async (e) => {
        setSyncStatus('Receiving Data...');
        await importDatabaseFromString(e.data);
        setSyncStatus('Database Successfully Updated!');
        setTimeout(cleanup, 3000);
      };
    };

    const offer = JSON.parse(scannedSignal);
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    peer.onicecandidate = (event) => {
      if (!event.candidate) {
        const signal = JSON.stringify(peer.localDescription);
        QRCode.toDataURL(signal, { margin: 2, scale: 8 }, (err, url) => {
          setQrData(url);
          setIsProcessing(false);
          setSyncStatus('Show this Answer back to the Host');
        });
      }
    };
  };

  const handleManualBackup = async () => {
    setIsProcessing(true);
    try {
      const backup = await exportFullDatabase();
      await shareToWhatsApp(backup);
    } catch (err) {
      alert("Backup failed: " + err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="bg-emerald-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-emerald-800 rounded-full radar-ring opacity-20"></div>
        <div className="absolute -right-10 -top-10 w-60 h-60 bg-emerald-700 rounded-full radar-ring opacity-20" style={{animationDelay: '0.5s'}}></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center">
            <Wifi size={48} className="text-emerald-400" />
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-4xl font-black">Sync Station</h2>
            <p className="text-emerald-300 font-bold uppercase tracking-widest text-xs mt-1">Zero-Data Local Tunnel Active</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-6">
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl text-xs font-bold border border-white/5">
                <ShieldCheck size={14} className="text-emerald-400" /> End-to-End Encrypted
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl text-xs font-bold border border-white/5">
                <Zap size={14} className="text-amber-400" /> Hotspot/Wi-Fi Required
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Sync Card */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <Smartphone size={24} className="text-emerald-600" /> Local Sync
            </h3>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${connectionState === 'connected' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
              {connectionState}
            </div>
          </div>

          {mode === 'idle' ? (
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={startHosting}
                className="group p-6 bg-slate-50 border border-slate-200 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left flex items-center gap-6"
              >
                <div className="p-4 bg-white rounded-2xl shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <Share2 size={24} />
                </div>
                <div>
                  <p className="font-black text-slate-800">Send Data (Host)</p>
                  <p className="text-xs text-slate-400 font-medium">Generate QR for second device to scan</p>
                </div>
              </button>

              <button 
                onClick={startJoining}
                className="group p-6 bg-slate-50 border border-slate-200 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left flex items-center gap-6"
              >
                <div className="p-4 bg-white rounded-2xl shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <Download size={24} />
                </div>
                <div>
                  <p className="font-black text-slate-800">Receive Data (Join)</p>
                  <p className="text-xs text-slate-400 font-medium">Scan Host QR to pull shop records</p>
                </div>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-6">
              {isProcessing ? (
                <div className="space-y-4">
                  <Loader2 size={48} className="animate-spin text-emerald-600 mx-auto" />
                  <p className="font-black text-slate-800">{syncStatus}</p>
                </div>
              ) : qrData ? (
                <div className="space-y-6 animate-in zoom-in duration-300">
                  <div className="p-4 bg-white border-4 border-emerald-500 rounded-[2.5rem] shadow-2xl inline-block">
                    <img src={qrData} alt="Handshake QR" className="w-64 h-64" />
                  </div>
                  <div className="space-y-2">
                    <p className="font-black text-slate-800">{syncStatus}</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">This handshake creates a secure direct link between terminals without internet.</p>
                  </div>
                  <button onClick={cleanup} className="flex items-center gap-2 text-rose-500 font-bold mx-auto">
                    <X size={16} /> Cancel Sync
                  </button>
                </div>
              ) : mode === 'join' && (
                <div className="w-full space-y-6">
                   <div className="w-full aspect-square bg-slate-100 rounded-[2.5rem] border-4 border-dashed border-slate-200 flex flex-col items-center justify-center group hover:border-emerald-400 transition-all relative overflow-hidden">
                      <Camera size={48} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                      <p className="text-slate-400 font-bold mt-4">Point Camera at Host QR</p>
                      {/* Note: Integration with a scanner would go here. For demo, we use a prompt or simple input. */}
                      <input 
                        type="text" 
                        placeholder="Paste Handshake Data (Dev Mode)" 
                        className="absolute bottom-4 inset-x-4 py-3 px-4 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                        onPaste={(e) => handleScanOffer(e.clipboardData.getData('text'))}
                      />
                   </div>
                   <button onClick={cleanup} className="flex items-center gap-2 text-slate-400 font-bold mx-auto">
                    <X size={16} /> Go Back
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Backup Card */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
          <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <Download size={24} className="text-emerald-600" /> Compressed Backup
          </h3>

          <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                   <ShieldCheck size={24} />
                </div>
                <div>
                   <p className="font-bold text-slate-800">End-of-Day Security</p>
                   <p className="text-xs text-slate-400">Save your records to WhatsApp daily.</p>
                </div>
             </div>
             
             <div className="pt-4 space-y-3">
                <button 
                  onClick={handleManualBackup}
                  disabled={isProcessing}
                  className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-200 active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="animate-spin" /> : <MessageCircle size={24} />}
                  Share Backup to WhatsApp
                </button>
                
                <label className="w-full py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black flex items-center justify-center gap-3 cursor-pointer hover:bg-slate-50 transition-all">
                  <RefreshCw size={20} />
                  Restore from File
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const content = reader.result as string;
                        // For WhatsApp backup, we strip the prefix if needed
                        const b64 = content.includes('\n\n') ? content.split('\n\n')[1] : content;
                        try {
                          await importDatabaseFromString(b64.trim());
                          alert("Restore successful!");
                          window.location.reload();
                        } catch (err) {
                          alert("Invalid backup file: " + err);
                        }
                      };
                      reader.readAsText(file);
                    }} 
                  />
                </label>
             </div>
          </div>

          <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100">
             <div className="flex gap-4">
                <WifiOff className="text-amber-600 shrink-0" size={20} />
                <p className="text-xs text-amber-700 font-medium leading-relaxed">
                  Backup strings are compressed using GZIP (Pako). Large inventories (1000+ items) result in strings that can be sent via WhatsApp for easy off-device storage.
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncStation;
