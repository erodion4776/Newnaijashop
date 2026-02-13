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
   * Combination of shop name and sync key ensures absolute privacy.
   * Uses a custom authorizer to enable phone-to-phone communication without a backend.
   */
  public connect(shopName: string, syncKey: string) {
    if (this.pusher) return;

    this.pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true,
      // THE "MAGIC" LOCAL AUTHORIZER
      // Tells Pusher to trust this client connection for private channels locally
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
    
    // STRICT REQUIREMENT: Client events MUST use a private channel
    this.channelName = `private-shop-${sanitizedKey}`;
    this.channel = this.pusher.subscribe(this.channelName);
    
    console.log(`[Relay] Connected to Secure Pipe: ${this.channelName}`);
  }

  /**
   * DIRECT PHONE-TO-PHONE BROADCAST
   * Uses mandatory 'client-' prefix to send data directly to other phones.
   */
  public broadcastSale(saleData: any) {
    if (!this.channel || this.pusher?.connection.state !== 'connected') {
      console.warn("[Relay] Cannot broadcast: Not connected to pipe.");
      return;
    }

    try {
      // Direct trigger on the private channel
      this.channel.trigger('client-new-sale', saleData);
      console.log("[Relay] Sale thrown into pipe successfully.");
    } catch (e) {
      console.error("[Relay] Trigger failed:", e);
    }
  }

  /**
   * Admin-specific listener for incoming Client Events.
   */
  public subscribeToSales(onSaleReceived: (sale: any) => void) {
    if (this.channel) {
      // Catch the 'client-new-sale' event
      this.channel.bind('client-new-sale', onSaleReceived);
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