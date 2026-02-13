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
   * ADMIN RECEIVER: 
   * Catches sales from staff phones and updates the master ledger.
   */
  const handleIncomingSale = useCallback(async (sale: Sale) => {
    if (!isAdmin) return;
    try {
      const exists = await db.sales.where('sale_id').equals(sale.sale_id).first();
      if (!exists) {
        await (db as any).transaction('rw', [db.sales, db.products, db.inventory_logs], async () => {
          // 1. Save the sale to Admin's local DB
          await db.sales.add({ ...sale, sync_status: 'synced' });
          
          // 2. Adjust Admin's Master Stock
          for (const item of sale.items) {
            const p = await db.products.get(item.productId);
            if (p) {
              const oldStock = Number(p.stock_qty);
              const newStock = Math.max(0, oldStock - Number(item.quantity));
              await db.products.update(item.productId, { stock_qty: newStock });
              
              // 3. Log the sync movement for accountability
              await db.inventory_logs.add({
                product_id: item.productId,
                product_name: p.name,
                quantity_changed: -item.quantity,
                old_stock: oldStock,
                new_stock: newStock,
                type: 'Sale',
                timestamp: Date.now(),
                performed_by: `Live Relay: ${sale.staff_name}`
              });
            }
          }
        });
        
        // 4. Trigger UI notification on Admin dashboard
        setLastIncomingSale(sale);
        setTimeout(() => setLastIncomingSale(null), 8000);
      }
    } catch (e) {
      console.error("[Sync] Incoming sale error:", e);
    }
  }, [isAdmin]);

  /**
   * STAFF RECEIVER:
   * Catches stock updates from Admin and refreshes the POS instantly.
   */
  const handleIncomingStock = useCallback(async (data: { products: Product[] }) => {
    if (isAdmin) return; // Only staff terminals accept stock pushes
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
          product_name: "Master Sync (Live)",
          quantity_changed: 0,
          old_stock: 0,
          new_stock: 0,
          type: 'Sync',
          timestamp: Date.now(),
          performed_by: 'Admin (Remote Push)'
        });
      });
      console.log("[Sync] Terminal inventory refreshed via live relay.");
    } catch (e) {
      console.error("[Sync] Stock update processing failed:", e);
    }
  }, [isAdmin]);

  useEffect(() => {
    let interval: any;
    const initRelay = async () => {
      const settings = await db.settings.get('app_settings');
      if (settings?.sync_key) {
        // Initialize direct relay connection
        RelayService.connect(settings.shop_name || 'Shop', settings.sync_key);
        
        // Subscribe to relevant events based on identity
        if (isAdmin) {
          RelayService.subscribeToSales(handleIncomingSale);
        } else {
          RelayService.subscribeToStockUpdates(handleIncomingStock);
        }

        // Pulse check for connection state
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
  }, [currentUser, isAdmin, handleIncomingSale, handleIncomingStock]);

  const broadcastSale = useCallback((sale: Sale) => RelayService.broadcastSale(sale), []);
  const broadcastStockUpdate = useCallback((products: Product[]) => RelayService.broadcastStockUpdate(products), []);

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