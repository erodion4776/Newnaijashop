import Pusher from 'pusher-js';

// Configuration placeholders for Pusher
const PUSHER_KEY = '8448b11165606d156641';
const PUSHER_CLUSTER = 'mt1';

class RelayService {
  private pusher: Pusher | null = null;
  private channel: any = null;
  private currentChannelName: string | null = null;

  /**
   * Initializes Pusher and subscribes to a unique shop channel.
   * Unique name is derived from shop name and master sync key.
   */
  public connect(shopName: string, syncKey: string) {
    if (this.pusher) return;

    this.pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true
    });

    const sanitizedName = shopName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const sanitizedKey = syncKey.replace(/[^a-z0-9]/g, '');
    this.currentChannelName = `private-relay-${sanitizedName}-${sanitizedKey}`;

    // Note: Since we are using public/private-ish naming without a real auth server
    // we use a generic channel name for now. For a production app, we'd add an auth endpoint.
    this.channel = this.pusher.subscribe(`relay-${sanitizedName}-${sanitizedKey}`);
  }

  public disconnect() {
    if (this.pusher && this.currentChannelName) {
      this.pusher.unsubscribe(this.currentChannelName);
      this.pusher.disconnect();
      this.pusher = null;
      this.channel = null;
    }
  }

  public on(event: string, callback: (data: any) => void) {
    if (this.channel) {
      this.channel.bind(event, callback);
    }
  }

  /**
   * BROADCAST ENGINE: Sends data to all other connected terminals.
   * In a real Pusher setup, client events require 'client-' prefix and private channels.
   * For this implementation, we assume a relay endpoint or use Pusher's testing triggering.
   */
  public send(event: string, data: any) {
    console.log(`[Relay] Sending ${event}:`, data);
    // Note: Standard pusher-js cannot trigger client events on public channels.
    // In a real production environment, this would hit a lightweight serverless function relay.
    // We simulate the logic for the UI.
  }

  public isConnected(): boolean {
    return this.pusher?.connection.state === 'connected';
  }
}

export default new RelayService();