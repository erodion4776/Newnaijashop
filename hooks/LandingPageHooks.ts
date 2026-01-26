/**
 * Utility to discover and intercept landing page CTA buttons
 */
export const initializeCTAHooks = (openBotWithContext: (ctaType: string, target: string) => void) => {
  const ctaSelectors = [
    'button',
    'a',
    '[role="button"]'
  ];

  const keywords = {
    'FREE_TRIAL': ['Free Trial', 'Start Now', 'Get Started', 'Sign Up', 'Register', 'Try it Now'],
    'PRICING': ['Pricing', 'Choose Your Access', 'Go Unlimited', 'Subscribe Now'],
    'DEMO': ['Demo', 'Show me', 'Try it']
  };

  const handleIntercept = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    const text = target.innerText || '';
    const href = (target as HTMLAnchorElement).href || '/setup';

    for (const [type, terms] of Object.entries(keywords)) {
      if (terms.some(term => text.toLowerCase().includes(term.toLowerCase()))) {
        e.preventDefault();
        e.stopPropagation();
        openBotWithContext(type, href);
        return;
      }
    }
  };

  const attachHooks = () => {
    const elements = document.querySelectorAll(ctaSelectors.join(','));
    elements.forEach(el => {
      // Avoid re-attaching
      if (el.hasAttribute('data-ns-hooked')) return;
      
      const text = el.textContent || '';
      const isCTA = Object.values(keywords).flat().some(term => 
        text.toLowerCase().includes(term.toLowerCase())
      );

      if (isCTA) {
        el.setAttribute('data-ns-hooked', 'true');
        el.addEventListener('click', handleIntercept as EventListener);
      }
    });
  };

  // Initial run
  attachHooks();

  // Observer for dynamic content (though landing page is mostly static)
  const observer = new MutationObserver(attachHooks);
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    const elements = document.querySelectorAll('[data-ns-hooked]');
    elements.forEach(el => {
      el.removeEventListener('click', handleIntercept as EventListener);
      el.removeAttribute('data-ns-hooked');
    });
  };
};