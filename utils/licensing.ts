
import { db } from '../db/db';

/**
 * Ensures a unique, persistent terminal ID for the device.
 * Checks DB first, generates and saves if missing.
 */
export const getOrCreateTerminalId = async (): Promise<string> => {
  const settings = await db.settings.get('app_settings');
  
  if (settings?.terminal_id) {
    return settings.terminal_id;
  }

  // Generate a high-entropy random ID
  const newId = `NS-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  
  if (settings) {
    await db.settings.update('app_settings', { terminal_id: newId });
  } else {
    // If settings don't exist yet (very early setup), we wait for setup to create them
    // but returning a valid string for the form
    return newId;
  }

  return newId;
};

/**
 * Kept for backwards compatibility during the shift, 
 * but now points to the persistent ID engine.
 */
export const generateRequestCode = async (): Promise<string> => {
  return await getOrCreateTerminalId();
};

export const validateLicense = (key: string, lastUsed: number): { valid: boolean; error?: string } => {
  if (!key) return { valid: false, error: 'License Key Required' };

  // 1. Format Check (KEY-YYYYMMDD)
  const regex = /^[A-Z0-9]+-(\d{8})$/;
  const match = key.match(regex);
  if (!match) return { valid: false, error: 'Invalid Key Format' };

  const dateStr = match[1];
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1;
  const day = parseInt(dateStr.substring(6, 8));
  const expiryDate = new Date(year, month, day);

  // 2. Expiration Check
  const now = new Date();
  if (now > expiryDate) return { valid: false, error: 'License Expired' };

  // 3. Anti-Tamper Check (Backdating Detection)
  const currentTimestamp = Date.now();
  if (lastUsed && currentTimestamp < lastUsed - 60000) { // Allow 1 min drift
    return { valid: false, error: 'System Clock Tampering Detected' };
  }

  return { valid: true };
};
