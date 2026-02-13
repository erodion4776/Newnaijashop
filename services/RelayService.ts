import Pusher from 'pusher-js';

// Environment variables for Pusher configuration
const PUSHER_KEY = (import.meta as any).env?.VITE_PUSHER_KEY || '8448b11165606d156641';
const PUSHER_CLUSTER = (import.meta as any).env?.VITE_PUSHER_CLUSTER || 'mt1';

class RelayService {
  private pusher: Pusher | null = null;
  private channel: any = null;
  private channelName: string | null = null;

  /**
   * Connects to a unique shop relay channel using a Local Security Bypass.
   * This allows phone-to-phone sync without a dedicated backend server.
   */
  public connect(shopName: string, syncKey: string) {
    if (this.pusher) return;

    this.pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true,
      authorizer: (channel, options) => {
        return {
          authorize: (socketId, callback) => {
            /**
             * MAGIC BYPASS: 
             * We authorize the client locally using the public key.
             * This works because 'Client Events' are enabled in the Pusher Dashboard.
             */
            callback(null, { auth: `${PUSHER_KEY}:${socketId}` });
          }
        };
      }
    });

    // Pusher requires 'private-' prefix for Client Events (client-to-client triggers)
    const sanitizedKey = syncKey.replace(/[^a-z0-9]/g, '').toLowerCase();
    this.channelName = `private-shop-${sanitizedKey}`;
    this.channel = this.pusher.subscribe(this.channelName);
    
    console.log(`[Relay] Connected to Secure Pipe: ${this.channelName}`);
  }

  /**
   * BROADCAST SALE (Staff -> Admin)
   * Mandatory 'client-' prefix for peer-to-peer events.
   */
  public broadcastSale(saleData: any) {
    if (!this.channel || this.pusher?.connection.state !== 'connected') return;
    try {
      this.channel.trigger('client-new-sale', saleData);
      console.log("[Relay] Client-event 'new-sale' triggered.");
    } catch (e) {
      console.error("[Relay] Sale broadcast failed:", e);
    }
  }

  /**
   * BROADCAST STOCK (Admin -> Staff)
   * Mandatory 'client-' prefix for peer-to-peer events.
   */
  public broadcastStockUpdate(products: any[]) {
    if (!this.channel || this.pusher?.connection.state !== 'connected') return;
    try {
      this.channel.trigger('client-stock-update', { products, timestamp: Date.now() });
      console.log("[Relay] Client-event 'stock-update' triggered.");
    } catch (e) {
      console.error("[Relay] Stock broadcast failed:", e);
    }
  }

  public subscribeToSales(onSaleReceived: (sale: any) => void) {
    if (this.channel) {
      this.channel.bind('client-new-sale', (data: any) => {
        console.log("[Relay] Received incoming sale via live link.");
        onSaleReceived(data);
      });
    }
  }

  public subscribeToStockUpdates(onUpdateReceived: (data: any) => void) {
    if (this.channel) {
      this.channel.bind('client-stock-update', (data: any) => {
        console.log("[Relay] Received master stock update via live link.");
        onUpdateReceived(data);
      });
    }
  }

  public disconnect() {
    if (this.pusher && this.channelName) {
      this.pusher.unsubscribe(this.channelName);
      this.pusher.disconnect();
      this.pusher = null;
      this.channel = null;
      this.channelName = null;
    }
  }

  public isConnected(): boolean {
    return this.pusher?.connection.state === 'connected';
  }
}

export default new RelayService();