
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db/db';
import { exportFullDatabase, importDatabaseFromString } from '../utils/backup';
import QRCode from 'qrcode';
import pako from 'pako';
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
  RefreshCw,
  ArrowRightLeft,
  CheckCircle2,
  Send
} from 'lucide-react';
import { Staff, Sale, Product } from '../types';

interface SyncStationProps {
  currentUser?: Staff | null;
}

const SyncStation: React.FC<SyncStationProps> = ({ currentUser }) => {
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';
  const [mode, setMode] = useState<'idle' | 'host' | 'join'>('idle');
  const [qrData, setQrData] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('Ready for Zero-Data Sync');
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const [manualCode, setManualCode] = useState('');

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

  const handleDataExchange = async (data: string) => {
    try {
      const payload = JSON.parse(data);
      
      if (isAdmin && payload.type === 'SALES_PUSH') {
        // Admin receives sales from Staff
        setSyncStatus('Admin: Reconciling Staff Sales...');
        await db.transaction('rw', [db.sales, db.products, db.inventory_logs], async () => {
          for (const sale of payload.sales as Sale[]) {
            const exists = await db.sales.get(sale.id!);
            if (!exists) {
              await db.sales.add({ ...sale, sync_status: 'synced' });
              // Deduct stock for these items on master device
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
        
        // After reconciling, send Master Inventory back to staff
        const masterProducts = await db.products.toArray();
        dataChannel.current?.send(JSON.stringify({ type: 'INVENTORY_PULL', products: masterProducts }));
        setSyncStatus('Admin: Sync Reconciled. Catalog Sent.');
        await db.settings.update('app_settings', { last_synced_timestamp: Date.now() });
      } 
      
      else if (!isAdmin && payload.type === 'INVENTORY_PULL') {
        // Staff receives master catalog from Admin
        setSyncStatus('Staff: Updating Catalog...');
        await db.transaction('rw', [db.products], async () => {
          await db.products.clear();
          await db.products.bulkAdd(payload.products);
        });
        
        // Mark local sales as synced
        await db.sales.where('sync_status').equals('pending').modify({ sync_status: 'synced' });
        
        setSyncStatus('Staff: Terminal Fully Synced!');
        await db.settings.update('app_settings', { last_synced_timestamp: Date.now() });
        setTimeout(cleanup, 2000);
      }
    } catch (e) {
      console.error("Sync Exchange Error", e);
      setSyncStatus('Error processing sync data.');
    }
  };

  const startHosting = async () => {
    setMode('host');
    setIsProcessing(true);
    setSyncStatus('Generating Offer...');
    const peer = setupWebRTC();
    dataChannel.current = peer.createDataChannel('sync-channel');
    
    dataChannel.current.onopen = async () => {
      setSyncStatus('Connected! Waiting for Data...');
      if (!isAdmin) {
        // Staff device: Immediately push pending sales to host (Admin)
        const pendingSales = await db.sales.where('sync_status').equals('pending').toArray();
        dataChannel.current?.send(JSON.stringify({ type: 'SALES_PUSH', sales: pendingSales }));
      }
    };

    dataChannel.current.onmessage = (e) => handleDataExchange(e.data);

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    peer.onicecandidate = (event) => {
      if (!event.candidate) {
        const signal = JSON.stringify(peer.localDescription);
        QRCode.toDataURL(signal, { margin: 2, scale: 8 }, (err, url) => {
          setQrData(url);
          setIsProcessing(false);
          setSyncStatus('Scan this QR on the second device');
        });
      }
    };
  };

  const startJoining = () => setMode('join');

  const handleScanOffer = async (scannedSignal: string) => {
    setIsProcessing(true);
    const peer = setupWebRTC();
    peer.ondatachannel = (event) => {
      dataChannel.current = event.channel;
      dataChannel.current.onopen = async () => {
        if (!isAdmin) {
          const pendingSales = await db.sales.where('sync_status').equals('pending').toArray();
          dataChannel.current?.send(JSON.stringify({ type: 'SALES_PUSH', sales: pendingSales }));
        }
      };
      dataChannel.current.onmessage = (e) => handleDataExchange(e.data);
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

  const handleWhatsAppExport = async () => {
    setIsProcessing(true);
    try {
      if (isAdmin) {
        const products = await db.products.toArray();
        const data = { type: 'INVENTORY_PULL', products };
        const compressed = pako.gzip(JSON.stringify(data));
        const b64 = btoa(String.fromCharCode.apply(null, Array.from(compressed)));
        window.open(`https://wa.me/?text=${encodeURIComponent(`📦 MASTER_INVENTORY:\n${b64}`)}`, '_blank');
      } else {
        const sales = await db.sales.where('sync_status').equals('pending').toArray();
        const data = { type: 'SALES_PUSH', sales };
        const compressed = pako.gzip(JSON.stringify(data));
        const b64 = btoa(String.fromCharCode.apply(null, Array.from(compressed)));
        window.open(`https://wa.me/?text=${encodeURIComponent(`📦 STAFF_SALES:\n${b64}`)}`, '_blank');
      }
    } catch (err) {
      alert("Export failed: " + err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWhatsAppImport = async () => {
    if (!manualCode.trim()) return;
    setIsProcessing(true);
    try {
      const b64 = manualCode.includes(':\n') ? manualCode.split(':\n')[1] : manualCode;
      const binaryString = atob(b64.trim());
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) uint8Array[i] = binaryString.charCodeAt(i);
      const decompressed = pako.ungzip(uint8Array, { to: 'string' });
      await handleDataExchange(decompressed);
      setManualCode('');
      alert("Import Successful!");
    } catch (err) {
      alert("Invalid Code: " + err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="bg-emerald-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center">
            <Wifi size={48} className="text-emerald-400" />
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-4xl font-black">Sync Station</h2>
            <p className="text-emerald-300 font-bold uppercase tracking-widest text-xs mt-1">Terminal Link Engine</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Local Sync Section */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <ArrowRightLeft size={24} className="text-emerald-600" /> Wi-Fi Exchange
            </h3>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${connectionState === 'connected' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
              {connectionState}
            </div>
          </div>

          {mode === 'idle' ? (
            <div className="grid grid-cols-1 gap-4">
              <button onClick={startHosting} className="group p-6 bg-slate-50 border border-slate-200 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left flex items-center gap-6">
                <div className="p-4 bg-white rounded-2xl shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <QrCode size={24} />
                </div>
                <div>
                  <p className="font-black text-slate-800">Generate Link QR</p>
                  <p className="text-xs text-slate-400 font-medium">{isAdmin ? "Admin: Receive Sales" : "Staff: Push Sales"}</p>
                </div>
              </button>
              <button onClick={startJoining} className="group p-6 bg-slate-50 border border-slate-200 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left flex items-center gap-6">
                <div className="p-4 bg-white rounded-2xl shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <Camera size={24} />
                </div>
                <div>
                  <p className="font-black text-slate-800">Scan Second Device</p>
                  <p className="text-xs text-slate-400 font-medium">Use camera to connect terminals</p>
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
                  <p className="font-black text-slate-800">{syncStatus}</p>
                  <button onClick={cleanup} className="flex items-center gap-2 text-rose-500 font-bold mx-auto"><X size={16} /> Cancel</button>
                </div>
              ) : mode === 'join' && (
                <div className="w-full space-y-6">
                   <div className="w-full aspect-square bg-slate-100 rounded-[2.5rem] border-4 border-dashed border-slate-200 flex flex-col items-center justify-center relative overflow-hidden group hover:border-emerald-400">
                      <Camera size={48} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                      <p className="text-slate-400 font-bold mt-4">Scan Terminal QR</p>
                      <input type="text" placeholder="Or Paste Code Here" className="absolute bottom-4 inset-x-4 py-3 px-4 bg-white border border-slate-200 rounded-xl text-xs outline-none" onPaste={(e) => handleScanOffer(e.clipboardData.getData('text'))} />
                   </div>
                   <button onClick={cleanup} className="flex items-center gap-2 text-slate-400 font-bold mx-auto"><X size={16} /> Go Back</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* WhatsApp Fallback Section */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
          <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <MessageCircle size={24} className="text-emerald-600" /> WhatsApp Link
          </h3>

          <div className="space-y-6">
            <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
              <p className="text-xs font-bold text-slate-500 uppercase">1. Export Sync Code</p>
              <button onClick={handleWhatsAppExport} disabled={isProcessing} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-emerald-200 active:scale-95 disabled:opacity-50">
                <Send size={18} /> {isAdmin ? "Export Master Catalog" : "Export Today's Sales"}
              </button>
            </div>

            <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
              <p className="text-xs font-bold text-slate-500 uppercase">2. Receive & Import</p>
              <textarea 
                placeholder="Paste code from WhatsApp here..." 
                className="w-full p-4 bg-white border border-slate-200 rounded-xl text-xs font-mono h-24 outline-none focus:ring-2 focus:ring-emerald-500"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
              />
              <button onClick={handleWhatsAppImport} disabled={isProcessing || !manualCode} className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black text-sm active:scale-95 disabled:opacity-50">
                Process Code
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncStation;
