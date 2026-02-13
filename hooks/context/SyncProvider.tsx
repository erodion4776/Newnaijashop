import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../../db/db';
import { Sale, SyncStatus, Staff, Product } from '../../types';
import RelayService from '../../services/RelayService';

interface SyncContextType {
  status: SyncStatus;
  broadcastSale: (sale: Sale) => void;
  broadcastStockUpdate: (products: Product[]) => void;
  lastIncomingSale: Sale | null;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode, currentUser: Staff | null }> = ({ children, currentUser }) => {
  const [status, setStatus] = useState<SyncStatus>('offline');
  const [lastIncomingSale, setLastIncomingSale] = useState<Sale | null>(null);
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  /**
   * STAFF HANDLER: Accepts inventory pushes from Admin
   */
  const handleIncomingStock = useCallback(async (data: { products: Product[] }) => {
    if (isAdmin) return;
    try {
      await (db as any).transaction('rw', [db.products, db.inventory_logs], async () => {
        await db.products.clear();
        await db.products.bulkAdd(data.products.map(p => ({
          ...p,
          price: Number(p.price),
          stock_qty: Number(p.stock_qty)
        })));
        await db.inventory_logs.add({
          product_id: 0,
          product_name: "Master Sync (Live Link)",
          quantity_changed: 0,
          old_stock: 0,
          new_stock: 0,
          type: 'Sync',
          timestamp: Date.now(),
          performed_by: 'Admin (Direct Push)'
        });
      });
    } catch (e) {
      console.error("[Sync] Live stock update failed:", e);
    }
  }, [isAdmin]);

  useEffect(() => {
    let interval: any;
    const initRelay = async () => {
      const settings = await db.settings.get('app_settings');
      if (settings?.sync_key) {
        // AUTOMATIC ACTIVATION: Initialize room for this shop
        RelayService.init(settings.sync_key);
        
        if (!isAdmin) {
          // Staff only needs to listen for stock updates here
          // Admin listens for sales in Dashboard.tsx as requested
          RelayService.listen('stock-update', handleIncomingStock);
        }

        interval = setInterval(() => {
          setStatus(RelayService.isConnected() ? 'live' : 'offline');
        }, 3000);
      }
    };

    if (currentUser) initRelay();

    return () => {
      if (interval) clearInterval(interval);
      RelayService.disconnect();
    };
  }, [currentUser, isAdmin, handleIncomingStock]);

  const broadcastSale = useCallback((sale: Sale) => RelayService.send('new-sale', sale), []);
  const broadcastStockUpdate = useCallback((products: Product[]) => RelayService.send('stock-update', { products }), []);

  return (
    <SyncContext.Provider value={{ status, broadcastSale, broadcastStockUpdate, lastIncomingSale }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error("useSync must be used within SyncProvider");
  return context;
};