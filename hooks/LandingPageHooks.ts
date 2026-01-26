// ============================================
// hooks/LandingPageHooks.ts
// CTA Button Discovery and Interception System
// ============================================

// ============================================
// TYPE DEFINITIONS
// ============================================

export type CTAType = 'FREE_TRIAL' | 'PRICING' | 'DEMO' | 'SIGNUP' | 'GENERAL';

export interface CTAInteraction {
  type: CTAType;
  element: HTMLElement;
  originalHref: string;
  originalText: string;
  timestamp: number;
}

// Legacy callback type (for backward compatibility)
type LegacyCallback = (ctaType: string, target: string) => void;

// New callback type (preferred)
type CTACallback = (interaction: CTAInteraction) => void;

// Union type to support both signatures
type CallbackType = LegacyCallback | CTACallback;

// ============================================
// CONFIGURATION
// ============================================

const CTA_SELECTORS = [
  '[data-cta]',           // Explicit data attribute (highest priority)
  '[data-ns-cta]',        // Alternative data attribute
  '.hero-cta',            // Common hero button class
  '.cta-button',          // Generic CTA class
  '.cta-primary',         // Primary CTA class
  'button',               // All buttons
  'a[href]',              // All links with href
  '[role="button"]'       // ARIA buttons
];

// Keywords mapped to CTA types (case-insensitive matching)
const CTA_KEYWORDS: Record<CTAType, string[]> = {
  'FREE_TRIAL': [
    // English
    'free trial', 'start trial', 'try free', 'try it', 'try now',
    'start now', 'get started', 'start free', '30 day', '30-day',
    'no credit card', 'no card required',
    // Nigerian Pidgin
    'try am', 'start am', 'test am', 'begin now'
  ],
  'PRICING': [
    // English
    'pricing', 'prices', 'plans', 'choose plan', 'select plan',
    'go unlimited', 'subscribe', 'subscription', 'upgrade',
    'choose your access', 'view pricing', 'see pricing',
    // Nigerian Pidgin
    'how much', 'wetin be price', 'check price'
  ],
  'DEMO': [
    // English
    'demo', 'watch demo', 'see demo', 'show me', 'see how',
    'how it works', 'learn more', 'watch video',
    // Nigerian Pidgin
    'show me how', 'make i see'
  ],
  'SIGNUP': [
    // English
    'sign up', 'signup', 'register', 'create account',
    'join now', 'join free', 'get access',
    // Nigerian Pidgin
    'join us', 'enter now'
  ],
  'GENERAL': [] // Fallback, no specific keywords
};

// Storage keys for session persistence
const STORAGE_KEYS = {
  ORIGINAL_DESTINATION: 'ns_original_cta_destination',
  CTA_TYPE: 'ns_cta_type',
  CTA_TEXT: 'ns_cta_text'
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Debounce function to limit rapid executions
 */
function debounce<T extends (...args: unknown[]) => void>(
  fn: T, 
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Determines CTA type from element attributes and text content
 */
function detectCTAType(element: HTMLElement): CTAType {
  // Priority 1: Explicit data attribute
  const explicitType = element.getAttribute('data-cta') || 
                       element.getAttribute('data-ns-cta');
  
  if (explicitType) {
    const upperType = explicitType.toUpperCase().replace(/-/g, '_');
    if (upperType in CTA_KEYWORDS) {
      return upperType as CTAType;
    }
  }
  
  // Priority 2: Text content matching
  const text = (element.innerText || element.textContent || '').toLowerCase().trim();
  
  for (const [type, keywords] of Object.entries(CTA_KEYWORDS)) {
    if (type === 'GENERAL') continue; // Skip fallback
    
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return type as CTAType;
      }
    }
  }
  
  // Priority 3: Href matching (for links)
  const href = (element as HTMLAnchorElement).href || '';
  if (href.includes('trial') || href.includes('signup') || href.includes('register')) {
    return 'FREE_TRIAL';
  }
  if (href.includes('pricing') || href.includes('plans')) {
    return 'PRICING';
  }
  if (href.includes('demo')) {
    return 'DEMO';
  }
  
  return 'GENERAL';
}

/**
 * Checks if an element is a relevant CTA button
 */
function isCTAElement(element: HTMLElement): boolean {
  // Check for explicit data attribute
  if (element.hasAttribute('data-cta') || element.hasAttribute('data-ns-cta')) {
    return true;
  }
  
  // Check for CTA classes
  const classList = element.className.toLowerCase();
  if (classList.includes('cta') || classList.includes('hero')) {
    return true;
  }
  
  // Check text content against keywords
  const text = (element.innerText || element.textContent || '').toLowerCase();
  const allKeywords = Object.values(CTA_KEYWORDS).flat();
  
  return allKeywords.some(keyword => text.includes(keyword.toLowerCase()));
}

/**
 * Gets the destination URL from an element
 */
function getDestination(element: HTMLElement): string {
  // Check for href attribute
  const href = (element as HTMLAnchorElement).href;
  if (href && !href.includes('javascript:') && !href.startsWith('#')) {
    return href;
  }
  
  // Check for data-href attribute
  const dataHref = element.getAttribute('data-href');
  if (dataHref) {
    return dataHref;
  }
  
  // Check for form action
  const form = element.closest('form');
  if (form?.action) {
    return form.action;
  }
  
  // Default fallback
  return '/setup';
}

/**
 * Determines if callback is new or legacy format
 */
function isLegacyCallback(callback: CallbackType): callback is LegacyCallback {
  // Legacy callback has 2 parameters, new has 1
  return callback.length === 2;
}

// ============================================
// MAIN INITIALIZATION FUNCTION
// ============================================

/**
 * Initializes CTA hooks to intercept button clicks and open the bot
 * 
 * @param callback - Function called when CTA is intercepted
 *                   Supports both legacy (type, href) and new (CTAInteraction) signatures
 * @returns Cleanup function to remove all hooks
 * 
 * @example
 * // New signature (preferred)
 * initializeCTAHooks((interaction) => {
 *   console.log(interaction.type, interaction.originalHref);
 *   openBot();
 * });
 * 
 * @example
 * // Legacy signature (backward compatible)
 * initializeCTAHooks((ctaType, target) => {
 *   console.log(ctaType, target);
 *   openBot();
 * });
 */
export const initializeCTAHooks = (callback: CallbackType): (() => void) => {
  // Track hooked elements to prevent duplicates
  const hookedElements = new WeakSet<HTMLElement>();
  
  /**
   * Click handler for intercepted CTAs
   */
  const handleIntercept = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    
    // Allow modifier keys to work normally (open in new tab, etc.)
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
      return;
    }
    
    // Prevent default navigation
    e.preventDefault();
    e.stopPropagation();
    
    // Gather interaction data
    const ctaType = detectCTAType(target);
    const originalHref = getDestination(target);
    const originalText = (target.innerText || target.textContent || '').trim();
    
    // Store for later redirect
    sessionStorage.setItem(STORAGE_KEYS.ORIGINAL_DESTINATION, originalHref);
    sessionStorage.setItem(STORAGE_KEYS.CTA_TYPE, ctaType);
    sessionStorage.setItem(STORAGE_KEYS.CTA_TEXT, originalText);
    
    // Create interaction object
    const interaction: CTAInteraction = {
      type: ctaType,
      element: target,
      originalHref,
      originalText,
      timestamp: Date.now()
    };
    
    // Call appropriate callback format
    if (isLegacyCallback(callback)) {
      callback(ctaType, originalHref);
    } else {
      callback(interaction);
    }
    
    // Analytics tracking (if available)
    if (typeof window !== 'undefined' && (window as unknown as { gtag?: Function }).gtag) {
      (window as unknown as { gtag: Function }).gtag('event', 'cta_intercepted', {
        cta_type: ctaType,
        cta_text: originalText,
        destination: originalHref
      });
    }
  };
  
  /**
   * Attaches click handlers to all discovered CTAs
   */
  const attachHooks = () => {
    const elements = document.querySelectorAll<HTMLElement>(CTA_SELECTORS.join(','));
    
    elements.forEach(el => {
      // Skip if already hooked (using WeakSet for memory efficiency)
      if (hookedElements.has(el)) return;
      
      // Skip if explicitly excluded
      if (el.hasAttribute('data-ns-no-intercept')) return;
      
      // Skip if not a relevant CTA
      if (!isCTAElement(el)) return;
      
      // Skip internal navigation links (hash links)
      const href = (el as HTMLAnchorElement).href || '';
      if (href.startsWith('#') || href.includes('javascript:void')) return;
      
      // Mark as hooked
      hookedElements.add(el);
      el.setAttribute('data-ns-hooked', 'true');
      
      // Attach listener
      el.addEventListener('click', handleIntercept as EventListener);
    });
  };
  
  // Debounced version for MutationObserver
  const debouncedAttachHooks = debounce(attachHooks, 100);
  
  // Initial attachment
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachHooks);
  } else {
    attachHooks();
  }
  
  // Watch for DOM changes (for SPAs and dynamic content)
  const observer = new MutationObserver((mutations) => {
    // Only re-scan if nodes were added
    const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);
    if (hasAddedNodes) {
      debouncedAttachHooks();
    }
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  // Return cleanup function
  return () => {
    // Disconnect observer
    observer.disconnect();
    
    // Remove event listeners from all hooked elements
    const elements = document.querySelectorAll<HTMLElement>('[data-ns-hooked]');
    elements.forEach(el => {
      el.removeEventListener('click', handleIntercept as EventListener);
      el.removeAttribute('data-ns-hooked');
    });
  };
};

// ============================================
// UTILITY EXPORTS
// ============================================

/**
 * Retrieves the stored CTA destination from session storage
 */
export function getStoredCTADestination(): string | null {
  return sessionStorage.getItem(STORAGE_KEYS.ORIGINAL_DESTINATION);
}

/**
 * Retrieves the stored CTA type from session storage
 */
export function getStoredCTAType(): CTAType | null {
  const type = sessionStorage.getItem(STORAGE_KEYS.CTA_TYPE);
  return type as CTAType | null;
}

/**
 * Clears stored CTA data
 */
export function clearStoredCTA(): void {
  sessionStorage.removeItem(STORAGE_KEYS.ORIGINAL_DESTINATION);
  sessionStorage.removeItem(STORAGE_KEYS.CTA_TYPE);
  sessionStorage.removeItem(STORAGE_KEYS.CTA_TEXT);
}

/**
 * Completes the CTA flow by redirecting to the original destination
 * Call this after the bot conversation is complete
 * 
 * @param delay - Milliseconds to wait before redirect (default: 1500)
 */
export function completeCTAFlowAndRedirect(delay: number = 1500): void {
  const destination = getStoredCTADestination();
  
  if (destination) {
    clearStoredCTA();
    
    // Show a brief message before redirect
    console.log(`[LandingPageHooks] Redirecting to: ${destination}`);
    
    setTimeout(() => {
      window.location.href = destination;
    }, delay);
  }
}

/**
 * Manually triggers a CTA interception programmatically
 * Useful for testing or custom integrations
 */
export function triggerCTAInterception(
  type: CTAType,
  callback: CTACallback,
  options: { href?: string; text?: string } = {}
): void {
  const interaction: CTAInteraction = {
    type,
    element: document.body, // Dummy element
    originalHref: options.href || '/setup',
    originalText: options.text || type,
    timestamp: Date.now()
  };
  
  // Store for later
  sessionStorage.setItem(STORAGE_KEYS.ORIGINAL_DESTINATION, interaction.originalHref);
  sessionStorage.setItem(STORAGE_KEYS.CTA_TYPE, type);
  
  callback(interaction);
}
