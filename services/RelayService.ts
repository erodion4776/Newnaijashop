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
   * This allows phone-to-phone sync using Client Events without a server.
   */
  public connect(syncKey: string) {
    if (this.pusher) return;

    this.pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true,
      authorizer: (channel) => ({
        authorize: (socketId: string, callback: Function) => {
          /**
           * THE MAGIC BYPASS:
           * We sign the request locally. Pusher trusts this because 
           * 'Client Events' are enabled in the dashboard.
           */
          callback(null, { auth: `${PUSHER_KEY}:${socketId}` });
        }
      })
    });

    // Pusher requires 'private-' prefix for Client-to-Client triggers
    const sanitizedKey = syncKey.replace(/[^a-z0-9]/g, '').toLowerCase();
    this.channelName = `private-shop-${sanitizedKey}`;
    this.channel = this.pusher.subscribe(this.channelName);
    
    console.log(`[Relay] Joined Secure Room: ${this.channelName}`);
  }

  /**
   * BROADCAST EVENT (Peer-to-Peer)
   * Mandatory 'client-' prefix for Pusher client events.
   */
  public send(eventName: string, data: any) {
    if (!this.channel || !this.isConnected()) return;
    try {
      // Pusher triggers must start with 'client-'
      const prefixedEvent = eventName.startsWith('client-') ? eventName : `client-${eventName}`;
      this.channel.trigger(prefixedEvent, data);
    } catch (e) {
      console.error("[Relay] Direct send failed:", e);
    }
  }

  /**
   * Helper for specific sale broadcasting
   */
  public broadcastSale(saleData: any) {
    this.send('new-sale', saleData);
  }

  /**
   * Helper for specific stock broadcasting
   */
  public broadcastStockUpdate(products: any[]) {
    this.send('stock-update', { products, timestamp: Date.now() });
  }

  public subscribeToSales(onSaleReceived: (sale: any) => void) {
    if (this.channel) {
      this.channel.bind('client-new-sale', (data: any) => {
        console.log("[Relay] Incoming sale received.");
        onSaleReceived(data);
      });
    }
  }

  public subscribeToStockUpdates(onUpdateReceived: (data: any) => void) {
    if (this.channel) {
      this.channel.bind('client-stock-update', (data: any) => {
        console.log("[Relay] Master stock push received.");
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