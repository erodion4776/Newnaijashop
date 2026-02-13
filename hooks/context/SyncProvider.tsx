import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../../db/db';
import { Sale, SyncStatus, Staff, Product } from '../../types';
import RelayService from '../../services/RelayService';

interface SyncContextType {
  status: SyncStatus;
  broadcastSale: (sale: Sale) => void;
  lastIncomingSale: Sale | null;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode, currentUser: Staff | null }> = ({ children, currentUser }) => {
  const [status, setStatus] = useState<SyncStatus>('offline');
  const [lastIncomingSale, setLastIncomingSale] = useState<Sale | null>(null);
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  const handleIncomingSale = useCallback(async (sale: Sale) => {
    // Only admins "catch" sales for the ledger
    if (!isAdmin) return;

    try {
      const exists = await db.sales.where('sale_id').equals(sale.sale_id).first();
      if (!exists) {
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
                performed_by: `Relay: ${sale.staff_name}`
              });
            }
          }
        });
        
        // Trigger UI notification in Dashboard
        setLastIncomingSale(sale);
        setTimeout(() => setLastIncomingSale(null), 8000);
      }
    } catch (e) {
      console.error("[Sync] Error processing incoming sale:", e);
    }
  }, [isAdmin]);

  useEffect(() => {
    let interval: any;
    
    const initRelay = async () => {
      const settings = await db.settings.get('app_settings');
      if (settings?.shop_name && settings?.sync_key) {
        RelayService.connect(settings.shop_name, settings.sync_key);
        
        if (isAdmin) {
          RelayService.subscribeToSales(handleIncomingSale);
        }

        // Monitoring Loop
        interval = setInterval(() => {
          setStatus(RelayService.isConnected() ? 'live' : 'offline');
        }, 3000);
      }
    };

    if (currentUser) {
      initRelay();
    }

    return () => {
      if (interval) clearInterval(interval);
      RelayService.disconnect();
    };
  }, [currentUser, isAdmin, handleIncomingSale]);

  const broadcastSale = useCallback((sale: Sale) => {
    RelayService.broadcastSale(sale);
  }, []);

  return (
    <SyncContext.Provider value={{ status, broadcastSale, lastIncomingSale }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error("useSync must be used within SyncProvider");
  return context;
};