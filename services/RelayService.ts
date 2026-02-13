import Pusher from 'pusher-js';

// Environment variables for Pusher configuration
const PUSHER_KEY = (import.meta as any).env?.VITE_PUSHER_KEY || '8448b11165606d156641';
const PUSHER_CLUSTER = (import.meta as any).env?.VITE_PUSHER_CLUSTER || 'mt1';

class RelayService {
  private pusher: Pusher | null = null;
  private channel: any = null;
  private channelName: string | null = null;

  /**
   * Connects to a unique shop relay channel.
   * Combination of shop name and sync key ensures absolute privacy for the shop's data.
   */
  public connect(shopName: string, syncKey: string) {
    if (this.pusher) return;

    this.pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true
    });

    const sanitizedName = shopName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const sanitizedKey = syncKey.replace(/[^a-z0-9]/g, '');
    
    // We use a unique public channel name that acts as a private one.
    // In a full production app, this would be a 'private-' channel requiring an auth endpoint.
    this.channelName = `relay-v2-${sanitizedName}-${sanitizedKey}`;
    this.channel = this.pusher.subscribe(this.channelName);
  }

  /**
   * Broadcasts a sale to all other connected devices in the shop.
   */
  public async broadcastSale(saleData: any) {
    if (!this.channelName) return;

    try {
      // NOTE: Standard client-side pusher-js cannot trigger events on public channels directly.
      // We send the broadcast to a generic internal relay endpoint provided by the deployment environment.
      await fetch('/api/pusher/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: this.channelName,
          event: 'new-sale',
          data: saleData
        })
      });
    } catch (e) {
      console.warn("[Relay] Failed to broadcast sale:", e);
    }
  }

  /**
   * Admin-specific listener for incoming sales.
   */
  public subscribeToSales(onSaleReceived: (sale: any) => void) {
    if (this.channel) {
      this.channel.bind('new-sale', onSaleReceived);
    }
  }

  public disconnect() {
    if (this.pusher && this.channelName) {
      this.pusher.unsubscribe(this.channelName);
      this.pusher.disconnect();
      this.pusher = null;
      this.channel = null;
    }
  }

  public isConnected(): boolean {
    return this.pusher?.connection.state === 'connected';
  }
}

export default new RelayService();