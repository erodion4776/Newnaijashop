import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { db } from '../../db/db';
import { Sale, SyncStatus, Staff, Product } from '../../types';
import RelayService from '../../services/RelayService';

interface SyncContextType {
  status: SyncStatus;
  relay: typeof RelayService;
  broadcastSale: (sale: Sale) => void;
  broadcastStockUpdate: (products: Product[]) => void;
  lastHeartbeat: number;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

const playCashSound = () => {
  try {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3');
    audio.play().catch(() => console.log("Sound blocked by browser policy until interaction."));
  } catch (e) {
    console.error("Audio error", e);
  }
};

const showToast = (msg: string) => {
  // Simple toast simulation or use a library if available
  console.log("Sync Toast:", msg);
};

export const SyncProvider: React.FC<{ children: React.ReactNode, currentUser: Staff | null }> = ({ children, currentUser }) => {
  const [status, setStatus] = useState<SyncStatus>('offline');
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(Date.now());
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  const handleIncomingSale = useCallback(async (sale: Sale) => {
    if (!isAdmin) return;

    const exists = await db.sales.where('sale_id').equals(sale.sale_id).first();
    if (!exists) {
      playCashSound();
      showToast(`New Sale from ${sale.staff_name}: ₦${sale.total_amount.toLocaleString()}`);
      
      await (db as any).transaction('rw', [db.sales, db.products, db.inventory_logs], async () => {
        await db.sales.add({ ...sale, sync_status: 'synced' });
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
              performed_by: `Relay Sync (${sale.staff_name})`
            });
          }
        }
      });
    }
  }, [isAdmin]);

  const handleIncomingStock = useCallback(async (payload: { products: Product[], timestamp: number }) => {
    if (isAdmin) return; // Only staff receive stock updates from Admin

    await (db as any).transaction('rw', [db.products, db.inventory_logs], async () => {
      await db.products.clear();
      await db.products.bulkAdd(payload.products);
      await db.inventory_logs.add({
        product_id: 0,
        product_name: 'Master Stock Sync',
        quantity_changed: 0,
        old_stock: 0,
        new_stock: 0,
        type: 'Sync',
        timestamp: Date.now(),
        performed_by: 'Admin Relay'
      });
    });
    showToast("Stock updated from Boss!");
  }, [isAdmin]);

  useEffect(() => {
    const initRelay = async () => {
      const settings = await db.settings.get('app_settings');
      if (settings?.shop_name && settings?.sync_key) {
        RelayService.connect(settings.shop_name, settings.sync_key);
        
        RelayService.on('new-sale', (data) => handleIncomingSale(data));
        RelayService.on('stock-update', (data) => handleIncomingStock(data));
        RelayService.on('ping', () => setLastHeartbeat(Date.now()));

        // Monitor connection status
        const interval = setInterval(() => {
          setStatus(RelayService.isConnected() ? 'live' : 'offline');
        }, 5000);

        return () => {
          clearInterval(interval);
          RelayService.disconnect();
        };
      }
    };

    initRelay();
  }, [handleIncomingSale, handleIncomingStock, currentUser]);

  const broadcastSale = useCallback((sale: Sale) => {
    RelayService.send('new-sale', sale);
  }, []);

  const broadcastStockUpdate = useCallback((products: Product[]) => {
    RelayService.send('stock-update', { products, timestamp: Date.now() });
  }, []);

  return (
    <SyncContext.Provider value={{ 
      status, 
      relay: RelayService,
      broadcastSale, 
      broadcastStockUpdate,
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