import { useEffect, useRef } from 'react';

interface ProactiveHooksProps {
  onTrigger: (message: string, triggerId: string) => void;
  isBotOpen: boolean;
  hasEngaged: boolean;
}

/**
 * Hook to manage proactive engagement triggers for the Landing Page
 */
export const useProactiveTriggers = ({ onTrigger, isBotOpen, hasEngaged }: ProactiveHooksProps) => {
  const sessionStartTime = useRef(Date.now());
  const timers = useRef<Record<string, any>>({});

  const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const canTrigger = (id: string) => {
    // 1. Don't trigger if already talking or engaged
    if (isBotOpen || hasEngaged) return false;
    
    // 2. 60-second cooldown after manual close
    const lastClose = parseInt(sessionStorage.getItem('ns_last_close_time') || '0');
    if (Date.now() - lastClose < 60000) return false;

    // 3. Fire only once per session per trigger type
    const alreadyFired = sessionStorage.getItem(`ns_fired_${id}`) === 'true';
    return !alreadyFired;
  };

  const markAsFired = (id: string) => {
    sessionStorage.setItem(`ns_fired_${id}`, 'true');
  };

  useEffect(() => {
    // We only care about triggers on the landing page
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') return;
    if (hasEngaged) return;

    // Trigger 4: Return Visitor
    const visitCount = parseInt(localStorage.getItem('naijaShopVisitCount') || '0');
    if (visitCount > 1 && canTrigger('RETURN_VISITOR')) {
      timers.current.returnVisitor = setTimeout(() => {
        if (canTrigger('RETURN_VISITOR')) {
          onTrigger(
            'Welcome back! 👋 Are you ready to start your 30-day free trial today and secure your shop records?',
            'RETURN_VISITOR'
          );
          markAsFired('RETURN_VISITOR');
        }
      }, 3000);
    }

    // Trigger 1: Scroll Depth (>40% and 8s delay)
    const handleScroll = () => {
      const scrollPct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      
      if (scrollPct > 0.4 && canTrigger('SCROLL_DEPTH')) {
        if (!timers.current.scrollTimer) {
          timers.current.scrollTimer = setTimeout(() => {
            if (canTrigger('SCROLL_DEPTH')) {
              onTrigger(
                'I see you are checking us out! 👀 Do you have any questions about how NaijaShop can help your business?',
                'SCROLL_DEPTH'
              );
              markAsFired('SCROLL_DEPTH');
            }
          }, 8000);
        }
      } else if (scrollPct <= 0.4) {
        clearTimeout(timers.current.scrollTimer);
        timers.current.scrollTimer = null;
      }
    };

    // Trigger 2: Exit Intent (Mouse moves to top of screen)
    const handleExitIntent = (e: MouseEvent) => {
      if (e.clientY <= 0 && canTrigger('EXIT_INTENT')) {
        onTrigger(
          'Wait a moment! Before you go... would you like me to show you how traders like you save 3 hours daily with NaijaShop? No commitment, just a quick chat.',
          'EXIT_INTENT'
        );
        markAsFired('EXIT_INTENT');
      }
    };

    // Trigger 3: Pricing Idle (15s idle while section is visible)
    const pricingObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          timers.current.pricingTimer = setTimeout(() => {
            if (canTrigger('PRICING_IDLE')) {
              onTrigger(
                'Pricing can be confusing sometimes 😅 Would you like me to help you pick the right plan for your budget?',
                'PRICING_IDLE'
              );
              markAsFired('PRICING_IDLE');
            }
          }, 15000);
        } else {
          clearTimeout(timers.current.pricingTimer);
        }
      },
      { threshold: 0.5 }
    );

    const pricingSection = document.getElementById('pricing-section');
    if (pricingSection) pricingObserver.observe(pricingSection);

    window.addEventListener('scroll', handleScroll);
    if (!isMobile()) {
      document.addEventListener('mouseleave', handleExitIntent);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mouseleave', handleExitIntent);
      pricingObserver.disconnect();
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, [isBotOpen, hasEngaged]);
};