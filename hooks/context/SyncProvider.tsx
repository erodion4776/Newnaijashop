import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import Peer from 'simple-peer';
import { db } from '../../db/db';
import { Sale, SyncStatus, Staff } from '../../types';

interface SyncContextType {
  status: SyncStatus;
  peer: any;
  sessionId: string | null;
  initiateSync: (initiator: boolean) => any;
  broadcastSale: (sale: Sale) => void;
  resetConnection: () => void;
  lastHeartbeat: number;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

// Cash Register Sound Helper
const playCashSound = () => {
  try {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3');
    audio.play().catch(() => console.log("Sound blocked by browser policy until interaction."));
  } catch (e) {
    console.error("Audio error", e);
  }
};

export const SyncProvider: React.FC<{ children: React.ReactNode, currentUser: Staff | null }> = ({ children, currentUser }) => {
  const [status, setStatus] = useState<SyncStatus>('offline');
  const [sessionId, setSessionId] = useState<string | null>(localStorage.getItem('last_sync_session'));
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(0);
  const peerRef = useRef<any>(null);
  const heartbeatIntervalRef = useRef<any>(null);
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  const resetConnection = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    setStatus('offline');
  }, []);

  const handleIncomingData = useCallback(async (data: string) => {
    try {
      const payload = JSON.parse(data);

      if (payload.type === 'HEARTBEAT') {
        setLastHeartbeat(Date.now());
        setStatus('live');
        return;
      }

      if (isAdmin && payload.type === 'INSTANT_SALE_PUSH') {
        const sale = payload.sale as Sale;
        const exists = await db.sales.where('sale_id').equals(sale.sale_id).first();
        
        if (!exists) {
          // Play notification sound on Admin device
          playCashSound();
          
          await (db as any).transaction('rw', [db.sales, db.products, db.inventory_logs], async () => {
            await db.sales.add({ ...sale, sync_status: 'synced' });
            
            // Mirror inventory deduction on Admin phone instantly
            for (const item of sale.items) {
              const p = await db.products.get(item.productId);
              if (p) {
                const oldStock = Number(p.stock_qty);
                const newStock = Math.max(0, oldStock - Number(item.quantity));
                await db.products.update(item.productId, { stock_qty: newStock });
                
                await db.inventory_logs.add({
                  product_id: item.productId,
                  product_name: p.name,
                  quantity_changed: -item.quantity,
                  old_stock: oldStock,
                  new_stock: newStock,
                  type: 'Sale',
                  timestamp: Date.now(),
                  performed_by: `Live Sync (${sale.staff_name})`
                });
              }
            }
          });
        }
      }
    } catch (e) {
      console.error("[SYNC] Data Error:", e);
    }
  }, [isAdmin]);

  const initiateSync = useCallback((initiator: boolean) => {
    resetConnection();
    
    const newSessionId = initiator ? Math.random().toString(36).substring(7) : (sessionId || 'pending');
    setSessionId(newSessionId);
    localStorage.setItem('last_sync_session', newSessionId);
    setStatus('connecting');

    const p = new Peer({
      initiator,
      trickle: false,
      // HOTSPOT OPTIMIZATION: Prioritize host candidates (local IPs)
      config: { 
        iceServers: [], // Empty iceServers forces host-only/STUN-less local discovery in many environments
        iceTransportPolicy: 'all'
      }
    });

    p.on('connect', () => {
      setStatus('live');
      setLastHeartbeat(Date.now());
      
      // HEARTBEAT LOGIC: 15s ping
      heartbeatIntervalRef.current = setInterval(() => {
        if (p.connected) {
          p.send(JSON.stringify({ type: 'HEARTBEAT', sessionId: newSessionId }));
          
          // Drop check: If no heartbeat response for 35s
          if (Date.now() - lastHeartbeat > 35000) {
            setStatus('reconnecting');
          }
        }
      }, 15000);
    });

    p.on('data', (data: any) => handleIncomingData(data.toString()));
    p.on('error', () => setStatus('failed'));
    p.on('close', () => setStatus('reconnecting'));

    peerRef.current = p;
    return p;
  }, [handleIncomingData, resetConnection, lastHeartbeat, sessionId]);

  const broadcastSale = useCallback((sale: Sale) => {
    if (peerRef.current?.connected) {
      peerRef.current.send(JSON.stringify({ type: 'INSTANT_SALE_PUSH', sale }));
    }
  }, []);

  // AUTO-RECONNECT LOGIC: If offline/failed but have a session, try to keep visible status
  useEffect(() => {
    if (status === 'offline' && sessionId) {
      // Logic for background handshake can go here or be triggered by UI
    }
  }, [status, sessionId]);

  return (
    <SyncContext.Provider value={{ 
      status, 
      peer: peerRef.current, 
      sessionId,
      initiateSync, 
      broadcastSale, 
      resetConnection,
      lastHeartbeat 
    }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error("useSync must be used within SyncProvider");
  return context;
};