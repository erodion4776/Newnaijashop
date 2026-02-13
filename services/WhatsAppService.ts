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
  },

  /**
   * Hybrid Share Method: Native Share + Clipboard Fallback
   * Optimized for Nigerian Android environment.
   */
  async shareMasterStock(compressedData: string) {
    const message = `📦 NAIJASHOP MASTER STOCK UPDATE\nCopy and send the code below to your staff:\n\n${compressedData}`;
    
    // STEP 1: Try Native Share (Text mode - works for long strings on Android)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'NaijaShop Update',
          text: message,
        });
        return true;
      } catch (err) {
        console.log("Native share failed, trying clipboard...");
      }
    }

    // STEP 2: Fallback - Copy to Clipboard
    try {
      await navigator.clipboard.writeText(compressedData);
      alert("✅ Stock Code Copied! Now paste it in your WhatsApp Group.");
      window.open('https://wa.me/', '_blank'); // Opens WhatsApp
      return true;
    } catch (err) {
      return false; // Last resort: trigger download in the component
    }
  },

  /**
   * Shares a file using the Web Share API (navigator.canShare).
   */
  shareFile: async (file: File, title: string, text: string): Promise<boolean> => {
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: title,
          text: text
        });
        return true;
      } catch (err) {
        console.warn('Share API failed or was cancelled:', err);
        return false;
      }
    }
    return false;
  }
};

export default WhatsAppService;