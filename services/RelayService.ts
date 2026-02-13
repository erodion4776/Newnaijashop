import Pusher from 'pusher-js';

// Environment variables for Pusher configuration
const PUSHER_KEY = (import.meta as any).env?.VITE_PUSHER_KEY || '8448b11165606d156641';
const PUSHER_CLUSTER = (import.meta as any).env?.VITE_PUSHER_CLUSTER || 'mt1';

class RelayService {
  private pusher: Pusher | null = null;
  private channel: any = null;
  private channelName: string | null = null;

  /**
   * Connects to a unique shop relay channel using Client Events.
   */
  public connect(shopName: string, syncKey: string) {
    if (this.pusher) return;

    this.pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true,
      authorizer: (channel, options) => {
        return {
          authorize: (socketId, callback) => {
            // Bypass server and authorize client locally
            callback(null, { auth: `${PUSHER_KEY}:${socketId}` });
          }
        };
      }
    });

    const sanitizedKey = syncKey.replace(/[^a-z0-9]/g, '').toLowerCase();
    this.channelName = `private-shop-${sanitizedKey}`;
    this.channel = this.pusher.subscribe(this.channelName);
    
    console.log(`[Relay] Connected to Secure Pipe: ${this.channelName}`);
  }

  /**
   * BROADCAST SALE (Staff -> Admin)
   */
  public broadcastSale(saleData: any) {
    if (!this.channel || this.pusher?.connection.state !== 'connected') return;
    try {
      this.channel.trigger('client-new-sale', saleData);
    } catch (e) {
      console.error("[Relay] Sale broadcast failed:", e);
    }
  }

  /**
   * BROADCAST STOCK (Admin -> Staff)
   */
  public broadcastStockUpdate(products: any[]) {
    if (!this.channel || this.pusher?.connection.state !== 'connected') return;
    try {
      this.channel.trigger('client-stock-update', { products, timestamp: Date.now() });
      console.log("[Relay] Master Stock broadcasted to staff.");
    } catch (e) {
      console.error("[Relay] Stock broadcast failed:", e);
    }
  }

  public subscribeToSales(onSaleReceived: (sale: any) => void) {
    if (this.channel) this.channel.bind('client-new-sale', onSaleReceived);
  }

  public subscribeToStockUpdates(onUpdateReceived: (data: any) => void) {
    if (this.channel) this.channel.bind('client-stock-update', onUpdateReceived);
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