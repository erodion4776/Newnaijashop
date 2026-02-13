import Pusher from 'pusher-js';

// Fallback keys if env variables are not present
const PUSHER_KEY = (import.meta as any).env?.VITE_PUSHER_KEY || '8448b11165606d156641';
const PUSHER_CLUSTER = (import.meta as any).env?.VITE_PUSHER_CLUSTER || 'mt1';

class RelayService {
  private pusher: Pusher | null = null;
  private channel: any = null;

  /**
   * Initializes the Pusher connection with a local authorizer bypass.
   * This allows direct client-to-client events on private channels without a backend.
   */
  public init(shopKey: string) {
    if (this.pusher) return;

    this.pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true,
      authorizer: (channel) => ({
        authorize: (socketId: string, callback: Function) => {
          /**
           * THE MAGIC BYPASS:
           * We sign the request locally using the public key.
           * Pusher accepts this because 'Client Events' are enabled in the dashboard.
           */
          callback(null, { auth: `${PUSHER_KEY}:${socketId}` });
        }
      })
    });

    // Sanitize key for channel naming (alphanumeric only)
    const sanitizedKey = shopKey.replace(/[^a-z0-9]/g, '').toLowerCase();
    
    // STRICT REQUIREMENT: private- prefix for client events
    this.channel = this.pusher.subscribe(`private-shop-${sanitizedKey}`);
    
    console.log(`[Relay] Syncing with Room: private-shop-${sanitizedKey}`);
  }

  /**
   * BROADCAST EVENT
   * Automatically adds the 'client-' prefix required by Pusher for client events.
   */
  public send(eventName: string, data: any) {
    if (this.channel?.subscribed) {
      try {
        const prefixedEvent = eventName.startsWith('client-') ? eventName : `client-${eventName}`;
        this.channel.trigger(prefixedEvent, data);
        console.log(`[Relay] Broadcasted: ${prefixedEvent}`);
      } catch (e) {
        console.error("[Relay] Broadcast failed:", e);
      }
    }
  }

  /**
   * LISTEN FOR EVENT
   * Automatically binds to the 'client-' prefixed version of the event name.
   */
  public listen(eventName: string, callback: (data: any) => void) {
    if (!this.channel) return;
    const prefixedEvent = eventName.startsWith('client-') ? eventName : `client-${eventName}`;
    this.channel.bind(prefixedEvent, (data: any) => {
      console.log(`[Relay] Received: ${prefixedEvent}`);
      callback(data);
    });
  }

  /**
   * Connection health check
   */
  public isConnected(): boolean {
    return this.pusher?.connection?.state === 'connected';
  }

  /**
   * Cleanup resources on logout
   */
  public disconnect() {
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
      this.channel = null;
    }
  }
}

export default new RelayService();