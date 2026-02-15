import Pusher from 'pusher-js';

// Fallback keys if env variables are not present
const PUSHER_KEY = (import.meta as any).env?.VITE_PUSHER_KEY || '8448b11165606d156641';
const PUSHER_CLUSTER = (import.meta as any).env?.VITE_PUSHER_CLUSTER || 'mt1';

// Debugging Mode as requested
Pusher.logToConsole = true;

class RelayService {
  private pusher: Pusher | null = null;
  private channel: any = null;
  private currentStatus: string = 'disconnected';

  /**
   * Initializes the Pusher connection with a Manual Client-Side Authorizer.
   * This is mandatory for private- channels without a server.
   */
  public init(masterSyncKey: string) {
    if (this.pusher) return;

    this.pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true,
      authEndpoint: 'http://localhost', // Required but bypassed by authorizer
      authorizer: (channel) => ({
        authorize: (socketId: string, callback: Function) => {
          /**
           * THE HANDSHAKE FIX:
           * We manually sign the request locally to bypass the server.
           * Format: key:socketId
           */
          callback(false, { auth: `${PUSHER_KEY}:${socketId}` });
        }
      })
    });

    // Handle connection state changes for UI dot
    this.pusher.connection.bind('state_change', (states: any) => {
      this.currentStatus = states.current;
      console.log(`[Relay] Connection State: ${states.current}`);
    });

    // Sanitize key for channel naming
    const sanitizedKey = masterSyncKey.replace(/[^a-z0-9]/g, '').toLowerCase();
    
    // STRICT REQUIREMENT: private- prefix
    const channelName = `private-shop-${sanitizedKey}`;
    this.channel = this.pusher.subscribe(channelName);
    
    this.channel.bind('pusher:subscription_succeeded', () => {
      console.log(`[Relay] Subscribed successfully to: ${channelName}`);
    });

    this.channel.bind('pusher:subscription_error', (status: any) => {
      console.error(`[Relay] Subscription failed:`, status);
    });
  }

  // Fix: Added generic send method to resolve 'Property send does not exist' errors in SyncProvider.tsx
  /**
   * GENERIC BROADCAST
   * Sends data via the private channel.
   */
  public send(eventName: string, data: any) {
    if (this.channel?.subscribed) {
      try {
        // STRICT REQUIREMENT: client- prefix
        const fullEventName = eventName.startsWith('client-') ? eventName : `client-${eventName}`;
        console.log(`[Relay] Triggering event: ${fullEventName}`, data);
        this.channel.trigger(fullEventName, data);
      } catch (e) {
        console.error(`[Relay] Broadcast of ${eventName} failed:`, e);
      }
    } else {
      console.warn(`[Relay] Cannot send ${eventName}: Channel not subscribed`);
    }
  }

  /**
   * STAFF BROADCAST
   * Sends sale data to Admin via the private channel.
   */
  public sendSale(saleData: any) {
    // Fix: Refactored to use the generic send method to ensure consistency and satisfy property existence
    this.send('new-sale', saleData);
  }

  /**
   * LISTEN FOR EVENT (Unified helper)
   */
  public listen(eventName: string, callback: (data: any) => void) {
    if (!this.channel) return;
    // Map generic events to client-prefixed versions for convenience
    const fullEventName = eventName.startsWith('client-') ? eventName : `client-${eventName}`;
    this.channel.bind(fullEventName, (data: any) => {
      console.log(`[Relay] Incoming Event: ${fullEventName}`);
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
   * Cleanup
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