import React, { 
  createContext, 
  useContext, 
  useState, 
  useRef, 
  useEffect, 
  useCallback 
} from 'react';
import Peer from 'simple-peer';
import LZString from 'lz-string';
import { db } from '../db/db';
import { Sale, Product, Staff } from '../types';

// ============ TYPES ============

export type SyncStatus = 'offline' | 'connecting' | 'live' | 'reconnecting' | 'failed';

interface SyncMessage {
  type: 'HEARTBEAT' | 'SALE_PUSH' | 'CATALOG_UPDATE' | 'SALE_ACK' | 'SYNC_REQUEST';
  sessionId?: string;
  timestamp?: number;
  sale?: Sale;
  products?: Product[];
  saleId?: number;
}

interface SyncContextType {
  status: SyncStatus;
  sessionId: string | null;
  connectedPeers: number;
  lastSyncTime: number | null;
  initiateSync: (initiator: boolean) => Peer.Instance;
  broadcastSale: (sale: Sale) => void;
  broadcastInventory: () => Promise<void>;
  processWhatsAppSync: (compressedData: string) => Promise<{ sales: number; products: number }>;
  resetConnection: () => void;
  requestSync: () => void;
}

interface PendingSale {
  sale: Sale;
  attempts: number;
  lastAttempt: number;
}

// ============ CONSTANTS ============

const HEARTBEAT_INTERVAL = 10000; // 10 seconds
const HEARTBEAT_TIMEOUT = 25000; // 25 seconds
const CONNECTION_TIMEOUT = 30000; // 30 seconds
const RECONNECT_WINDOW = 60000; // 60 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000; // 5 seconds

// ============ CONTEXT ============

const SyncContext = createContext<SyncContextType | undefined>(undefined);

// ============ PROVIDER ============

interface SyncProviderProps {
  children: React.ReactNode;
  currentUser: Staff | null;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children, currentUser }) => {
  // State
  const [status, setStatus] = useState<SyncStatus>('offline');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [connectedPeers, setConnectedPeers] = useState(0);

  // Refs (to avoid stale closures)
  const peerRef = useRef<Peer.Instance | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatRef = useRef<number>(0);
  const statusRef = useRef<SyncStatus>('offline');
  const pendingSalesRef = useRef<Map<number, PendingSale>>(new Map());
  const sessionIdRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';
  const isAdminRef = useRef(isAdmin);
  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  // ============ CLEANUP ============

  const clearTimers = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }
  }, []);

  const resetConnection = useCallback(() => {
    console.log('[SYNC] Resetting connection...');
    
    clearTimers();
    
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch (e) {
        console.warn('[SYNC] Error destroying peer:', e);
      }
      peerRef.current = null;
    }
    
    setStatus('offline');
    setConnectedPeers(0);
    lastHeartbeatRef.current = 0;
    pendingSalesRef.current.clear();
  }, [clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetConnection();
    };
  }, [resetConnection]);

  // ============ DATA HANDLERS ============

  const sendMessage = useCallback((message: SyncMessage) => {
    if (peerRef.current?.connected) {
      try {
        // Compress large payloads
        const data = JSON.stringify(message);
        const payload = data.length > 1000 
          ? LZString.compressToUTF16(data)
          : data;
        
        peerRef.current.send(payload);
        return true;
      } catch (e) {
        console.error('[SYNC] Send error:', e);
        return false;
      }
    }
    return false;
  }, []);

  const handleSalePush = useCallback(async (sale: Sale, sendAck: boolean = true) => {
    if (!isAdminRef.current) return;

    try {
      // Better duplicate detection: check timestamp AND staff_id AND total
      const exists = await db.sales
        .where('timestamp')
        .equals(sale.timestamp)
        .filter(s => s.staff_id === sale.staff_id && s.total_amount === sale.total_amount)
        .first();

      if (exists) {
        console.log('[SYNC] Duplicate sale ignored:', sale.timestamp);
        return;
      }

      await db.transaction('rw', [db.sales, db.products, db.inventory_logs], async () => {
        // Add sale
        const saleId = await db.sales.add({ 
          ...sale, 
          sync_status: 'synced',
          synced_at: Date.now()
        });

        // Update stock and create logs
        for (const item of sale.items) {
          const product = await db.products.get(item.productId);
          if (product) {
            const oldStock = product.stock_qty;
            const newStock = Math.max(0, oldStock - item.quantity);
            
            await db.products.update(item.productId, { stock_qty: newStock });

            // Create inventory log
            await db.inventory_logs.add({
              product_id: item.productId,
              product_name: item.name,
              quantity_changed: -item.quantity,
              old_stock: oldStock,
              new_stock: newStock,
              type: 'sale',
              performed_by: sale.staff_id || 'Sync',
              timestamp: Date.now()
            });
          }
        }
      });

      // Send acknowledgment
      if (sendAck) {
        sendMessage({ type: 'SALE_ACK', saleId: sale.id, timestamp: sale.timestamp });
      }

      console.log('[SYNC] Sale synced successfully:', sale.timestamp);
      setLastSyncTime(Date.now());
    } catch (e) {
      console.error('[SYNC] Error processing sale:', e);
    }
  }, [sendMessage]);

  const handleCatalogUpdate = useCallback(async (products: Product[]) => {
    if (isAdminRef.current) return; // Only staff should receive catalog

    try {
      await db.transaction('rw', [db.products, db.settings], async () => {
        // Clear and repopulate
        await db.products.clear();
        await db.products.bulkAdd(products);
        
        // Update sync timestamp
        await db.settings.update('app_settings', { 
          last_synced_timestamp: Date.now() 
        });
      });

      console.log('[SYNC] Catalog updated:', products.length, 'products');
      setLastSyncTime(Date.now());
    } catch (e) {
      console.error('[SYNC] Error updating catalog:', e);
    }
  }, []);

  const handleSaleAck = useCallback((saleId: number | undefined, timestamp: number | undefined) => {
    // Remove from pending queue
    if (timestamp) {
      pendingSalesRef.current.delete(timestamp);
    }
    console.log('[SYNC] Sale acknowledged:', saleId || timestamp);
  }, []);

  const handleIncomingData = useCallback(async (rawData: string) => {
    try {
      // Try to decompress if compressed
      let data = rawData;
      try {
        const decompressed = LZString.decompressFromUTF16(rawData);
        if (decompressed) data = decompressed;
      } catch (e) {
        // Not compressed, use raw data
      }

      const message: SyncMessage = JSON.parse(data);

      switch (message.type) {
        case 'HEARTBEAT':
          lastHeartbeatRef.current = Date.now();
          if (statusRef.current !== 'live') {
            setStatus('live');
          }
          break;

        case 'SALE_PUSH':
          if (message.sale) {
            await handleSalePush(message.sale);
          }
          break;

        case 'CATALOG_UPDATE':
          if (message.products) {
            await handleCatalogUpdate(message.products);
          }
          break;

        case 'SALE_ACK':
          handleSaleAck(message.saleId, message.timestamp);
          break;

        case 'SYNC_REQUEST':
          // Staff requesting latest catalog
          if (isAdminRef.current) {
            await broadcastInventory();
          }
          break;

        default:
          console.warn('[SYNC] Unknown message type:', message.type);
      }
    } catch (e) {
      console.error('[SYNC] Error processing incoming data:', e);
    }
  }, [handleSalePush, handleCatalogUpdate, handleSaleAck]);

  // ============ HEARTBEAT ============

  const startHeartbeat = useCallback(() => {
    // Clear existing
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    lastHeartbeatRef.current = Date.now();

    heartbeatIntervalRef.current = setInterval(() => {
      if (!peerRef.current?.connected) return;

      // Send heartbeat
      sendMessage({ type: 'HEARTBEAT', timestamp: Date.now() });

      // Check for timeout (using ref, not state)
      const timeSinceLastHeartbeat = Date.now() - lastHeartbeatRef.current;
      if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
        console.warn('[SYNC] Heartbeat timeout');
        if (statusRef.current === 'live') {
          setStatus('reconnecting');
        }
      }
    }, HEARTBEAT_INTERVAL);
  }, [sendMessage]);

  // ============ RETRY QUEUE ============

  const startRetryQueue = useCallback(() => {
    if (retryIntervalRef.current) return;

    retryIntervalRef.current = setInterval(() => {
      if (!peerRef.current?.connected) return;

      const now = Date.now();
      pendingSalesRef.current.forEach((pending, timestamp) => {
        if (now - pending.lastAttempt > RETRY_DELAY) {
          if (pending.attempts >= MAX_RETRY_ATTEMPTS) {
            // Give up after max attempts
            console.error('[SYNC] Sale failed after max retries:', timestamp);
            pendingSalesRef.current.delete(timestamp);
          } else {
            // Retry
            const sent = sendMessage({ type: 'SALE_PUSH', sale: pending.sale });
            if (sent) {
              pending.attempts++;
              pending.lastAttempt = now;
            }
          }
        }
      });
    }, RETRY_DELAY);
  }, [sendMessage]);

  // ============ INITIATE SYNC ============

  const initiateSync = useCallback((initiator: boolean): Peer.Instance => {
    resetConnection();

    // Generate new session ID
    const newSessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    setSessionId(newSessionId);
    sessionIdRef.current = newSessionId;
    setStatus('connecting');

    console.log('[SYNC] Initiating sync as', initiator ? 'HOST' : 'JOINER', 'Session:', newSessionId);

    const peer = new Peer({
      initiator,
      trickle: false, // Wait for complete ICE gathering
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    // Connection timeout
    connectionTimeoutRef.current = setTimeout(() => {
      if (statusRef.current === 'connecting') {
        console.warn('[SYNC] Connection timeout');
        setStatus('failed');
        peer.destroy();
      }
    }, CONNECTION_TIMEOUT);

    peer.on('signal', (data) => {
      console.log('[SYNC] Signal generated:', data.type);
      // Signal is handled by SyncStation component
    });

    peer.on('connect', () => {
      console.log('[SYNC] Connected!');
      
      // Clear connection timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }

      setStatus('live');
      setConnectedPeers(1);
      lastHeartbeatRef.current = Date.now();
      setLastSyncTime(Date.now());

      // Start heartbeat
      startHeartbeat();

      // Start retry queue
      startRetryQueue();

      // If admin, send catalog immediately
      if (isAdminRef.current) {
        setTimeout(() => {
          broadcastInventory();
        }, 1000);
      }
    });

    peer.on('data', (data: Buffer | string) => {
      const dataStr = typeof data === 'string' ? data : data.toString();
      handleIncomingData(dataStr);
    });

    peer.on('error', (err) => {
      console.error('[SYNC] Peer error:', err.message);
      
      // Don't immediately fail on all errors
      if (err.message.includes('User-Initiated') || err.message.includes('destroyed')) {
        return;
      }
      
      setStatus('failed');
    });

    peer.on('close', () => {
      console.log('[SYNC] Connection closed');
      
      clearTimers();
      setConnectedPeers(0);

      if (statusRef.current === 'live' || statusRef.current === 'reconnecting') {
        setStatus('reconnecting');
        
        // Auto-fail after reconnect window
        reconnectTimeoutRef.current = setTimeout(() => {
          if (statusRef.current === 'reconnecting') {
            setStatus('failed');
          }
        }, RECONNECT_WINDOW);
      } else {
        setStatus('offline');
      }
    });

    peerRef.current = peer;
    return peer;
  }, [resetConnection, handleIncomingData, startHeartbeat, startRetryQueue, clearTimers]);

  // ============ BROADCAST FUNCTIONS ============

  const broadcastSale = useCallback((sale: Sale) => {
    if (!peerRef.current?.connected) {
      console.warn('[SYNC] Cannot broadcast sale: not connected');
      return;
    }

    const sent = sendMessage({ type: 'SALE_PUSH', sale });
    
    if (sent && sale.timestamp) {
      // Add to pending queue for retry
      pendingSalesRef.current.set(sale.timestamp, {
        sale,
        attempts: 1,
        lastAttempt: Date.now()
      });
    }

    console.log('[SYNC] Sale broadcast:', sent ? 'sent' : 'queued');
  }, [sendMessage]);

  const broadcastInventory = useCallback(async () => {
    if (!peerRef.current?.connected) {
      console.warn('[SYNC] Cannot broadcast inventory: not connected');
      return;
    }

    if (!isAdminRef.current) {
      console.warn('[SYNC] Only admin can broadcast inventory');
      return;
    }

    try {
      const products = await db.products.toArray();
      const sent = sendMessage({ type: 'CATALOG_UPDATE', products });
      
      console.log('[SYNC] Inventory broadcast:', products.length, 'products', sent ? 'sent' : 'failed');
    } catch (e) {
      console.error('[SYNC] Error broadcasting inventory:', e);
    }
  }, [sendMessage]);

  const requestSync = useCallback(() => {
    if (!peerRef.current?.connected) return;
    sendMessage({ type: 'SYNC_REQUEST' });
  }, [sendMessage]);

  // ============ WHATSAPP SYNC ============

  const processWhatsAppSync = useCallback(async (compressedData: string): Promise<{ sales: number; products: number }> => {
    let salesCount = 0;
    let productCount = 0;

    try {
      // Try different decompression methods
      let json: string | null = null;
      
      // Try URI-encoded compression first
      json = LZString.decompressFromEncodedURIComponent(compressedData);
      
      // Try base64 compression
      if (!json) {
        json = LZString.decompressFromBase64(compressedData);
      }
      
      // Try UTF16 compression
      if (!json) {
        json = LZString.decompressFromUTF16(compressedData);
      }
      
      // Try raw JSON
      if (!json) {
        try {
          JSON.parse(compressedData);
          json = compressedData;
        } catch (e) {
          // Not valid JSON
        }
      }

      if (!json) {
        throw new Error('Could not decompress data. Invalid format.');
      }

      const payload = JSON.parse(json);

      // Validate payload structure
      if (!payload.type) {
        throw new Error('Invalid sync data: missing type');
      }

      if (payload.type === 'WHATSAPP_EXPORT' || payload.type === 'STAFF_SALES_REPORT') {
        // Admin importing Staff sales
        if (isAdminRef.current && payload.sales && Array.isArray(payload.sales)) {
          for (const sale of payload.sales) {
            try {
              await handleSalePush(sale, false);
              salesCount++;
            } catch (e) {
              console.error('[SYNC] Error importing sale:', e);
            }
          }
        }
        // Staff importing Admin catalog
        else if (!isAdminRef.current && payload.products && Array.isArray(payload.products)) {
          await handleCatalogUpdate(payload.products);
          productCount = payload.products.length;
        }
      }

      // Update sync time
      if (salesCount > 0 || productCount > 0) {
        setLastSyncTime(Date.now());
      }

      return { sales: salesCount, products: productCount };
    } catch (e: any) {
      console.error('[SYNC] WhatsApp sync error:', e);
      throw new Error(`Sync Failed: ${e.message}`);
    }
  }, [handleSalePush, handleCatalogUpdate]);

  // ============ CONTEXT VALUE ============

  const contextValue: SyncContextType = {
    status,
    sessionId,
    connectedPeers,
    lastSyncTime,
    initiateSync,
    broadcastSale,
    broadcastInventory,
    processWhatsAppSync,
    resetConnection,
    requestSync
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  );
};

// ============ HOOK ============

export const useSync = (): SyncContextType => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};

export default SyncProvider;
