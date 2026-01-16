
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import Peer from 'simple-peer';
import LZString from 'lz-string';
import { db } from '../db/db';
import { Sale, SyncStatus, Staff } from '../types';

interface SyncContextType {
  status: SyncStatus;
  peer: any;
  sessionId: string | null;
  initiateSync: (initiator: boolean) => any;
  broadcastSale: (sale: Sale) => void;
  broadcastInventory: () => void;
  processWhatsAppSync: (compressedData: string) => Promise<{ sales: number, products: number }>;
  resetConnection: () => void;
  lastHeartbeat: number;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode, currentUser: Staff | null }> = ({ children, currentUser }) => {
  const [status, setStatus] = useState<SyncStatus>('offline');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(0);
  const peerRef = useRef<any>(null);
  const heartbeatIntervalRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  const resetConnection = useCallback(() => {
    console.log('[SYNC] Force Clearing Connection Objects...');
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    clearInterval(heartbeatIntervalRef.current);
    clearTimeout(reconnectTimeoutRef.current);
    setStatus('offline');
    setLastHeartbeat(0);
  }, []);

  const handleIncomingData = useCallback(async (data: string) => {
    try {
      const payload = JSON.parse(data);

      if (payload.type === 'HEARTBEAT') {
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
      console.error("[SYNC] Real-time Data Error:", e);
    }
  }, [isAdmin]);

  const initiateSync = useCallback((initiator: boolean) => {
    resetConnection();
    
    // THE FRESH SESSION RULE
    const newSessionId = Math.random().toString(36).substring(7);
    setSessionId(newSessionId);
    setStatus('connecting');

    const p = new Peer({
      initiator,
      trickle: false,
      config: { iceServers: [] }
    });

    p.on('connect', () => {
      console.log('[SYNC] P2P Linked Successfully!');
      setStatus('live');
      setLastHeartbeat(Date.now());
      
      // THE HEARTBEAT RULE: Tiny ping every 10 seconds
      heartbeatIntervalRef.current = setInterval(() => {
        if (p.connected) {
          p.send(JSON.stringify({ type: 'HEARTBEAT' }));
          // Check if we lost the other side
          if (Date.now() - lastHeartbeat > 25000) {
            setStatus('reconnecting');
          }
        }
      }, 10000);
    });

    p.on('data', (data: any) => handleIncomingData(data.toString()));

    p.on('error', (err: any) => {
      console.error("[SYNC] Peer Error:", err);
      setStatus('failed');
    });

    p.on('close', () => {
      if (status === 'live') {
        setStatus('reconnecting');
        // Auto-Reconnect window (60 seconds)
        reconnectTimeoutRef.current = setTimeout(() => {
          if (status !== 'live') setStatus('failed');
        }, 60000);
      } else {
        setStatus('offline');
      }
    });

    peerRef.current = p;
    return p;
  }, [handleIncomingData, resetConnection, lastHeartbeat, status]);

  const broadcastSale = useCallback((sale: Sale) => {
    // THE AUTO-PUSH RULE
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

  const processWhatsAppSync = async (compressedData: string) => {
    try {
      const json = LZString.decompressFromEncodedURIComponent(compressedData);
      if (!json) throw new Error("Invalid or Corrupt Data String");
      const payload = JSON.parse(json);
      
      let salesCount = 0;
      let productCount = 0;

      if (payload.type === 'WHATSAPP_EXPORT') {
        // Handle Admin importing Staff sales
        if (isAdmin && payload.sales) {
          for (const sale of payload.sales) {
            const exists = await db.sales.where('timestamp').equals(sale.timestamp).first();
            if (!exists) {
              await (db as any).transaction('rw', [db.sales, db.products], async () => {
                await db.sales.add({ ...sale, sync_status: 'synced' });
                for (const item of sale.items) {
                  const p = await db.products.get(item.productId);
                  if (p) await db.products.update(item.productId, { stock_qty: Math.max(0, p.stock_qty - item.quantity) });
                }
              });
              salesCount++;
            }
          }
        }
        // Handle Staff importing Admin catalog
        else if (!isAdmin && payload.products) {
          await (db as any).transaction('rw', [db.products], async () => {
            await db.products.clear();
            await db.products.bulkAdd(payload.products);
          });
          productCount = payload.products.length;
          await db.settings.update('app_settings', { last_synced_timestamp: Date.now() });
        }
      }
      return { sales: salesCount, products: productCount };
    } catch (e: any) {
      throw new Error("Sync Failed: " + e.message);
    }
  };

  useEffect(() => {
    return () => resetConnection();
  }, [resetConnection]);

  return (
    <SyncContext.Provider value={{ 
      status, 
      peer: peerRef.current, 
      sessionId,
      initiateSync, 
      broadcastSale, 
      broadcastInventory,
      processWhatsAppSync,
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
