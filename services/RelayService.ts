import Pusher from 'pusher-js';

// Environment variables for Pusher configuration
const PUSHER_KEY = (import.meta as any).env?.VITE_PUSHER_KEY || '8448b11165606d156641';
const PUSHER_CLUSTER = (import.meta as any).env?.VITE_PUSHER_CLUSTER || 'mt1';

class RelayService {
  private pusher: Pusher | null = null;
  private channel: any = null;

  /**
   * Initializes the Pusher connection with a local authorizer bypass.
   * This allows direct client-to-client events on private channels.
   */
  public init(shopKey: string) {
    if (this.pusher) return;

    this.pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true,
      authorizer: (channel, options) => {
        return {
          authorize: (socketId, callback) => {
            // Bypass server and authorize client locally using the public key
            callback(null, { auth: `${PUSHER_KEY}:${socketId}` });
          }
        };
      }
    });

    const sanitizedKey = shopKey.replace(/[^a-z0-9]/g, '').toLowerCase();
    this.channel = this.pusher.subscribe(`private-shop-${sanitizedKey}`);
    
    console.log(`[Relay] Connected to Secure Pipe: private-shop-${sanitizedKey}`);
  }

  /**
   * BROADCAST EVENT
   * Automatically adds the 'client-' prefix required by Pusher for client events.
   */
  public send(eventName: string, data: any) {
    if (this.channel?.subscribed) {
      try {
        this.channel.trigger(`client-${eventName}`, data);
        console.log(`[Relay] Triggered client-${eventName}`);
      } catch (e) {
        console.error("[Relay] Event broadcast failed:", e);
      }
    }
  }

  /**
   * LISTEN FOR EVENT
   * Automatically binds to the 'client-' prefixed version of the event name.
   */
  public listen(eventName: string, callback: (data: any) => void) {
    if (!this.channel) return;
    this.channel.bind(`client-${eventName}`, (data: any) => {
      console.log(`[Relay] Received client-${eventName}`);
      callback(data);
    });
  }

  /**
   * Checks if the socket is currently in a connected state.
   */
  public isConnected(): boolean {
    return this.pusher?.connection.state === 'connected';
  }

  /**
   * Disconnects and cleans up resources.
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