
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import Peer from 'simple-peer';
import LZString from 'lz-string';
import { db } from '../db/db';
import { Sale, SyncStatus, Staff } from '../types';

interface SyncContextType {
  status: SyncStatus;
  peer: any;
  initiateSync: (initiator: boolean, mode: 'host' | 'join') => any;
  broadcastSale: (sale: Sale) => void;
  broadcastInventory: () => void;
  resetConnection: () => void;
  lastHeartbeat: number;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode, currentUser: Staff | null }> = ({ children, currentUser }) => {
  const [status, setStatus] = useState<SyncStatus>('offline');
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(0);
  const peerRef = useRef<any>(null);
  const heartbeatIntervalRef = useRef<any>(null);
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  const resetConnection = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    clearInterval(heartbeatIntervalRef.current);
    setStatus('offline');
    setLastHeartbeat(0);
  }, []);

  const handleIncomingData = useCallback(async (data: string) => {
    try {
      const payload = JSON.parse(data);

      if (payload.type === 'PING') {
        setLastHeartbeat(Date.now());
        if (peerRef.current?.connected) {
          peerRef.current.send(JSON.stringify({ type: 'PONG' }));
        }
        return;
      }

      if (payload.type === 'PONG') {
        setLastHeartbeat(Date.now());
        setStatus('live');
        return;
      }

      if (isAdmin && payload.type === 'SALE_PUSH') {
        const sale = payload.sale as Sale;
        const exists = await db.sales.where('timestamp').equals(sale.timestamp).first();
        if (!exists) {
          await (db as any).transaction('rw', [db.sales, db.products], async () => {
            await db.sales.add({ ...sale, sync_status: 'synced' });
            for (const item of sale.items) {
              const p = await db.products.get(item.productId);
              if (p) await db.products.update(item.productId, { stock_qty: Math.max(0, p.stock_qty - item.quantity) });
            }
          });
        }
      } else if (!isAdmin && payload.type === 'CATALOG_UPDATE') {
        await (db as any).transaction('rw', [db.products], async () => {
          await db.products.clear();
          await db.products.bulkAdd(payload.products);
        });
        await db.settings.update('app_settings', { last_synced_timestamp: Date.now() });
      }
    } catch (e) {
      console.error("[SYNC] Data Error:", e);
    }
  }, [isAdmin]);

  const initiateSync = useCallback((initiator: boolean, mode: 'host' | 'join') => {
    resetConnection();
    setStatus('connecting');

    const p = new Peer({
      initiator,
      trickle: false,
      config: { iceServers: [] }
    });

    p.on('connect', () => {
      setStatus('live');
      setLastHeartbeat(Date.now());
      
      // Start Heartbeat
      heartbeatIntervalRef.current = setInterval(() => {
        if (p.connected) {
          p.send(JSON.stringify({ type: 'PING' }));
          // If we haven't seen a pong in 10s, mark as reconnecting
          if (Date.now() - lastHeartbeat > 10000) {
            setStatus('reconnecting');
          }
        }
      }, 5000);
    });

    p.on('data', (data: any) => handleIncomingData(data.toString()));

    p.on('error', (err: any) => {
      console.error("[SYNC] Peer Error:", err);
      setStatus('offline');
    });

    p.on('close', () => setStatus('offline'));

    peerRef.current = p;
    return p;
  }, [handleIncomingData, resetConnection, lastHeartbeat]);

  const broadcastSale = useCallback((sale: Sale) => {
    if (peerRef.current?.connected) {
      peerRef.current.send(JSON.stringify({ type: 'SALE_PUSH', sale }));
    }
  }, []);

  const broadcastInventory = useCallback(async () => {
    if (peerRef.current?.connected && isAdmin) {
      const products = await db.products.toArray();
      peerRef.current.send(JSON.stringify({ type: 'CATALOG_UPDATE', products }));
    }
  }, [isAdmin]);

  // Cleanup on unmount
  useEffect(() => {
    return () => resetConnection();
  }, [resetConnection]);

  return (
    <SyncContext.Provider value={{ 
      status, 
      peer: peerRef.current, 
      initiateSync, 
      broadcastSale, 
      broadcastInventory,
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
