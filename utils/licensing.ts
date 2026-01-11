
export const generateRequestCode = (): string => {
  const browserInfo = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    navigator.hardwareConcurrency
  ].join('|');
  
  // Simple hashing function for a unique fingerprint
  let hash = 0;
  for (let i = 0; i < browserInfo.length; i++) {
    const char = browserInfo.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `NS-${Math.abs(hash).toString(16).toUpperCase().substring(0, 8)}`;
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
