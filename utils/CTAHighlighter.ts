// ============================================
// CTAHighlighter.ts - Visual CTA Attention System
// ============================================

export type HighlightIntensity = 'subtle' | 'strong' | 'urgent';

// ============================================
// STATE MANAGEMENT
// ============================================

interface HighlighterState {
  isActive: boolean;
  currentIntensity: HighlightIntensity | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
  resizeHandler: (() => void) | null;
  scrollHandler: (() => void) | null;
  originalButtonText: string | null;
  arrowElement: HTMLElement | null;
}

const state: HighlighterState = {
  isActive: false,
  currentIntensity: null,
  timeoutId: null,
  resizeHandler: null,
  scrollHandler: null,
  originalButtonText: null,
  arrowElement: null
};

// Cooldown tracking
let lastTriggerTime = 0;
const COOLDOWN_MS = 2000; // 2 seconds between triggers

// ============================================
// CSS INJECTION (Run once on load)
// ============================================

const CSS_STYLES = `
  /* CTA Highlighter Animations */
  
  @keyframes pulse-subtle-anim {
    0%, 100% { 
      transform: scale(1); 
      box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); 
    }
    50% { 
      transform: scale(1.02); 
      box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); 
    }
  }

  @keyframes pulse-strong-anim {
    0%, 100% { 
      transform: scale(1); 
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); 
    }
    50% { 
      transform: scale(1.05); 
      box-shadow: 0 0 0 20px rgba(34, 197, 94, 0); 
    }
  }

  @keyframes shake-urgent-anim {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }

  @keyframes float-arrow-anim {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  @keyframes glow-pulse {
    0%, 100% { box-shadow: 0 0 5px rgba(34, 197, 94, 0.5); }
    50% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.8), 0 0 30px rgba(34, 197, 94, 0.4); }
  }

  .pulse-subtle {
    animation: pulse-subtle-anim 2s ease-in-out infinite;
    will-change: transform, box-shadow;
  }

  .pulse-strong {
    animation: pulse-strong-anim 1.5s ease-in-out infinite, glow-pulse 1.5s ease-in-out infinite;
    will-change: transform, box-shadow;
  }

  .shake-urgent {
    animation: shake-urgent-anim 0.5s ease-in-out 3;
    will-change: transform;
  }

  .cta-highlight-arrow {
    position: fixed;
    font-size: 32px;
    pointer-events: none;
    z-index: 9999;
    animation: float-arrow-anim 1s ease-in-out infinite;
    will-change: transform;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
  }

  /* Accessibility: Reduce motion for users who prefer it */
  @media (prefers-reduced-motion: reduce) {
    .pulse-subtle,
    .pulse-strong,
    .shake-urgent,
    .cta-highlight-arrow {
      animation: none;
    }
    
    .pulse-subtle,
    .pulse-strong {
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.6);
    }
  }
`;

let cssInjected = false;

/**
 * Injects the required CSS into the document head
 * Only runs once, even if called multiple times
 */
function injectCSS(): void {
  if (cssInjected) return;
  
  const styleElement = document.createElement('style');
  styleElement.id = 'cta-highlighter-styles';
  styleElement.textContent = CSS_STYLES;
  document.head.appendChild(styleElement);
  
  cssInjected = true;
}

// ============================================
// CTA BUTTON FINDER
// ============================================

/**
 * Finds the primary CTA button using multiple strategies
 */
function findPrimaryCTA(): HTMLElement | null {
  // Strategy 1: Explicit data attribute (recommended)
  const byDataAttr = document.querySelector('[data-cta="primary"]');
  if (byDataAttr) return byDataAttr as HTMLElement;
  
  // Strategy 2: Hero CTA class
  const byHeroClass = document.querySelector('.hero-cta');
  if (byHeroClass) return byHeroClass as HTMLElement;
  
  // Strategy 3: Button or link containing trial-related text
  const trialKeywords = ['trial', 'start', 'get started', 'try', 'sign up', 'free'];
  const allButtons = document.querySelectorAll('button, a.btn, a.button, [role="button"]');
  
  for (const btn of Array.from(allButtons)) {
    const text = (btn as HTMLElement).innerText?.toLowerCase() || '';
    if (trialKeywords.some(keyword => text.includes(keyword))) {
      return btn as HTMLElement;
    }
  }
  
  // Strategy 4: First prominent button in hero section
  const heroSection = document.querySelector('.hero, [data-section="hero"], header');
  if (heroSection) {
    const heroBtn = heroSection.querySelector('button, a.btn');
    if (heroBtn) return heroBtn as HTMLElement;
  }
  
  return null;
}

// ============================================
// CLEANUP FUNCTION
// ============================================

/**
 * Removes all highlighting effects and resets state
 */
function cleanup(): void {
  // Clear any pending timeout
  if (state.timeoutId) {
    clearTimeout(state.timeoutId);
    state.timeoutId = null;
  }
  
  // Remove event listeners
  if (state.resizeHandler) {
    window.removeEventListener('resize', state.resizeHandler);
    state.resizeHandler = null;
  }
  
  if (state.scrollHandler) {
    window.removeEventListener('scroll', state.scrollHandler);
    state.scrollHandler = null;
  }
  
  // Remove arrow element
  if (state.arrowElement) {
    state.arrowElement.remove();
    state.arrowElement = null;
  }
  
  // Find and clean up button
  const btn = findPrimaryCTA();
  if (btn) {
    btn.classList.remove('pulse-subtle', 'pulse-strong', 'shake-urgent');
    
    // Restore original text if we changed it
    if (state.originalButtonText) {
      btn.innerText = state.originalButtonText;
      // Restore aria-label as well
      btn.removeAttribute('aria-live');
    }
  }
  
  // Also remove any orphaned arrows
  const orphanedArrows = document.querySelectorAll('.cta-highlight-arrow');
  orphanedArrows.forEach(arrow => arrow.remove());
  
  // Reset state
  state.isActive = false;
  state.currentIntensity = null;
  state.originalButtonText = null;
}

// ============================================
// ARROW POSITIONING
// ============================================

/**
 * Creates and positions the floating arrow indicator
 */
function createArrow(btn: HTMLElement): HTMLElement {
  const arrow = document.createElement('div');
  arrow.className = 'cta-highlight-arrow';
  arrow.id = 'cta-highlight-arrow';
  arrow.innerHTML = '⬇️';
  arrow.setAttribute('aria-hidden', 'true'); // Hide from screen readers
  
  document.body.appendChild(arrow);
  
  return arrow;
}

/**
 * Updates arrow position to stay above the button
 */
function updateArrowPosition(arrow: HTMLElement, btn: HTMLElement): void {
  const rect = btn.getBoundingClientRect();
  
  // Use fixed positioning (relative to viewport)
  arrow.style.top = `${rect.top - 50}px`;
  arrow.style.left = `${rect.left + rect.width / 2 - 16}px`;
}

// ============================================
// ANALYTICS HOOK
// ============================================

type AnalyticsCallback = (data: {
  intensity: HighlightIntensity;
  timestamp: number;
  buttonText: string;
  triggerSource?: string;
}) => void;

let analyticsCallback: AnalyticsCallback | null = null;

/**
 * Registers a callback to be notified when CTA is highlighted
 * Useful for tracking conversion funnel
 */
export function onCTAHighlight(callback: AnalyticsCallback): void {
  analyticsCallback = callback;
}

// ============================================
// MAIN TRIGGER FUNCTION
// ============================================

/**
 * Triggers a visual highlight on the primary CTA button
 * 
 * @param intensity - 'subtle' (gentle pulse), 'strong' (glow + arrow), 'urgent' (shake + text change)
 * @param options - Additional configuration options
 */
export function triggerTryOnHighlight(
  intensity: HighlightIntensity,
  options: {
    duration?: number;      // How long to show (default: 5000ms)
    scrollIntoView?: boolean; // Scroll button into view (default: true on desktop)
    source?: string;        // For analytics tracking
  } = {}
): void {
  const {
    duration = 5000,
    scrollIntoView = true,
    source = 'bot'
  } = options;
  
  // ─────────────────────────────────────────
  // STEP 1: Cooldown Check
  // ─────────────────────────────────────────
  const now = Date.now();
  if (now - lastTriggerTime < COOLDOWN_MS) {
    console.debug('[CTAHighlighter] Cooldown active, skipping trigger');
    return;
  }
  lastTriggerTime = now;
  
  // ─────────────────────────────────────────
  // STEP 2: Ensure CSS is injected
  // ─────────────────────────────────────────
  injectCSS();
  
  // ─────────────────────────────────────────
  // STEP 3: Find CTA Button
  // ─────────────────────────────────────────
  const btn = findPrimaryCTA();
  if (!btn) {
    console.warn('[CTAHighlighter] Could not find CTA button');
    return;
  }
  
  // ─────────────────────────────────────────
  // STEP 4: Cleanup any existing animation
  // ─────────────────────────────────────────
  if (state.isActive) {
    cleanup();
  }
  
  // ─────────────────────────────────────────
  // STEP 5: Store original state
  // ─────────────────────────────────────────
  state.isActive = true;
  state.currentIntensity = intensity;
  state.originalButtonText = btn.innerText;
  
  // ─────────────────────────────────────────
  // STEP 6: Scroll into view (desktop only)
  // ─────────────────────────────────────────
  if (scrollIntoView && window.innerWidth > 768) {
    // Check if button is already in viewport
    const rect = btn.getBoundingClientRect();
    const isInViewport = (
      rect.top >= 0 &&
      rect.bottom <= window.innerHeight
    );
    
    if (!isInViewport) {
      btn.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }
  
  // ─────────────────────────────────────────
  // STEP 7: Apply animation based on intensity
  // ─────────────────────────────────────────
  switch (intensity) {
    case 'subtle':
      btn.classList.add('pulse-subtle');
      break;

    case 'strong':
      btn.classList.add('pulse-strong');
      
      // Create floating arrow
      const arrow = createArrow(btn);
      state.arrowElement = arrow;
      
      // Initial position
      updateArrowPosition(arrow, btn);
      
      // Update position on resize
      state.resizeHandler = () => updateArrowPosition(arrow, btn);
      window.addEventListener('resize', state.resizeHandler);
      
      // Update position on scroll (FIXED)
      state.scrollHandler = () => updateArrowPosition(arrow, btn);
      window.addEventListener('scroll', state.scrollHandler, { passive: true });
      break;

    case 'urgent':
      btn.classList.add('shake-urgent');
      
      // Change button text with accessibility consideration
      btn.setAttribute('aria-live', 'polite'); // Announce to screen readers
      btn.innerText = '👆 Click Here Now!';
      
      // Revert text after 3 seconds (before full cleanup)
      setTimeout(() => {
        if (state.originalButtonText && state.isActive) {
          btn.innerText = state.originalButtonText;
          btn.removeAttribute('aria-live');
        }
      }, 3000);
      break;
  }
  
  // ─────────────────────────────────────────
  // STEP 8: Fire analytics callback
  // ─────────────────────────────────────────
  if (analyticsCallback) {
    try {
      analyticsCallback({
        intensity,
        timestamp: now,
        buttonText: state.originalButtonText || '',
        triggerSource: source
      });
    } catch (e) {
      console.error('[CTAHighlighter] Analytics callback error:', e);
    }
  }
  
  // ─────────────────────────────────────────
  // STEP 9: Schedule cleanup
  // ─────────────────────────────────────────
  state.timeoutId = setTimeout(cleanup, duration);
}

// ============================================
// MANUAL CLEANUP EXPORT
// ============================================

/**
 * Manually stops any active CTA highlight
 * Useful when user clicks the CTA or closes the chat
 */
export function stopHighlight(): void {
  cleanup();
}

// ============================================
// CHECK IF ACTIVE
// ============================================

/**
 * Returns whether a highlight is currently active
 */
export function isHighlightActive(): boolean {
  return state.isActive;
}

// ============================================
// INITIALIZE ON LOAD
// ============================================

// Auto-inject CSS when module loads (if in browser)
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // Inject CSS after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCSS);
  } else {
    injectCSS();
  }
}
