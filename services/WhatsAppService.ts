import { Settings } from '../types';

/**
 * Handles WhatsApp routing for reports and updates.
 * Uses direct links if configured, otherwise falls back to standard sharing.
 */
export const WhatsAppService = {
  send: async (message: string, settings: Settings | undefined, type: 'DIRECT_REPORT' | 'GROUP_UPDATE') => {
    const encoded = encodeURIComponent(message);
    
    // Direct routing to Boss for Staff Reports
    if (type === 'DIRECT_REPORT' && settings?.admin_whatsapp_number) {
      window.open(`https://wa.me/${settings.admin_whatsapp_number}?text=${encoded}`, '_blank');
      return;
    } 
    
    // Direct routing to Shop Group for Master Updates
    if (type === 'GROUP_UPDATE' && settings?.whatsapp_group_link) {
      const baseUrl = settings.whatsapp_group_link.replace(/\/$/, "");
      window.open(`${baseUrl}?text=${encoded}`, '_blank');
      return;
    }

    // Fallback for non-configured terminals
    const url = `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  }
};

export default WhatsAppService;