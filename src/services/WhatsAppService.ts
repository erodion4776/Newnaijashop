import { Settings } from '../types';

class WhatsAppService {
  /**
   * Routes a message to the appropriate WhatsApp destination.
   * @param message The text content to send.
   * @param settings The terminal settings containing configured direct links.
   * @param type The context of the message (direct report vs group update).
   */
  public async send(message: string, settings: Settings | undefined, type: 'DIRECT_REPORT' | 'GROUP_UPDATE') {
    const encoded = encodeURIComponent(message);
    
    if (type === 'DIRECT_REPORT') {
      if (settings?.admin_whatsapp_number) {
        window.open(`https://wa.me/${settings.admin_whatsapp_number}?text=${encoded}`, '_blank');
        return;
      }
    } else if (type === 'GROUP_UPDATE') {
      if (settings?.whatsapp_group_link) {
        const baseUrl = settings.whatsapp_group_link.replace(/\/$/, "");
        window.open(`${baseUrl}?text=${encoded}`, '_blank');
        return;
      }
    }

    // Fallback: Standard share sheet if direct routing isn't configured
    if (navigator.share) {
      try {
        await navigator.share({
          title: type === 'GROUP_UPDATE' ? 'NaijaShop Stock Update' : 'NaijaShop Report',
          text: message
        });
        return;
      } catch (e) {
        console.warn('Share cancelled or failed', e);
      }
    }

    // Final Fallback: Open WhatsApp with no specific recipient
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  }
}

export default new WhatsAppService();