import { useEffect, useRef } from 'react';

interface ProactiveHooksProps {
  onTrigger: (message: string, triggerId: string) => void;
  isBotOpen: boolean;
  hasEngaged: boolean;
}

/**
 * Custom hook to manage proactive marketing engagement triggers
 */
export const useProactiveTriggers = ({ onTrigger, isBotOpen, hasEngaged }: ProactiveHooksProps) => {
  const sessionStartTime = useRef(Date.now());
  const timers = useRef<Record<string, any>>({});

  const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const canTrigger = (id: string) => {
    if (isBotOpen || hasEngaged) return false;
    
    // 60-second cooldown after manual close
    const lastClose = parseInt(sessionStorage.getItem('ns_last_close_time') || '0');
    if (Date.now() - lastClose < 60000) return false;

    // Fire only once per session
    const alreadyFired = sessionStorage.getItem(`ns_fired_${id}`) === 'true';
    return !alreadyFired;
  };

  const markAsFired = (id: string) => {
    sessionStorage.setItem(`ns_fired_${id}`, 'true');
  };

  useEffect(() => {
    if (hasEngaged) return;

    // Trigger 4: Return Visitor (Check on mount)
    const visitCount = parseInt(localStorage.getItem('naijaShopVisitCount') || '0');
    if (visitCount > 1 && canTrigger('RETURN_VISITOR')) {
      timers.current.returnVisitor = setTimeout(() => {
        if (canTrigger('RETURN_VISITOR')) {
          onTrigger(
            'Welcome back! 👋 It is good to see you again. Are you ready to start your 30-day free trial today?',
            'RETURN_VISITOR'
          );
          markAsFired('RETURN_VISITOR');
        }
      }, 5000);
    }

    // Trigger 1: Scroll Depth (>40% and 8s on site)
    const handleScroll = () => {
      const scrollPct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      const timeOnSite = (Date.now() - sessionStartTime.current) / 1000;

      if (scrollPct > 0.4 && timeOnSite >= 8 && canTrigger('SCROLL_DEPTH')) {
        onTrigger(
          'I see you are checking us out! 👀 Do you have any questions about how NaijaShop can help your business?',
          'SCROLL_DEPTH'
        );
        markAsFired('SCROLL_DEPTH');
      }
    };

    // Trigger 2: Exit Intent (Mouse < 10px from top)
    const handleExitIntent = (e: MouseEvent) => {
      if (e.clientY < 10 && canTrigger('EXIT_INTENT')) {
        onTrigger(
          'Wait a moment! Before you go... would you like me to show you how traders like you save 3 hours daily with NaijaShop? No commitment, just a quick chat.',
          'EXIT_INTENT'
        );
        markAsFired('EXIT_INTENT');
      }
    };

    // Trigger 3: Pricing Idle (15s in section)
    const pricingObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          timers.current.pricingIdle = setTimeout(() => {
            if (canTrigger('PRICING_IDLE')) {
              onTrigger(
                'Pricing can be confusing sometimes 😅 Would you like me to help you pick the right plan for your budget?',
                'PRICING_IDLE'
              );
              markAsFired('PRICING_IDLE');
            }
          }, 15000);
        } else {
          if (timers.current.pricingIdle) {
            clearTimeout(timers.current.pricingIdle);
          }
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
  }, [isBotOpen, hasEngaged, onTrigger]);
};
