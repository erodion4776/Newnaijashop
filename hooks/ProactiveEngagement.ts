import { useEffect, useRef } from 'react';

/**
 * Hook to manage proactive marketing triggers for the Landing Page
 */
export const useProactiveTriggers = (
  openBotWithMessage: (msg: string, triggerId: string) => void,
  isBotOpen: boolean
) => {
  const engagementRef = useRef({
    hasTriggered: false,
    lastTriggerTime: 0,
    scrollTimer: null as any,
    pricingTimer: null as any,
  });

  const canTrigger = () => {
    const now = Date.now();
    const hasEngaged = sessionStorage.getItem('hasEngaged') === 'true';
    const cooldown = now - engagementRef.current.lastTriggerTime > 60000; // 60s cooldown
    return !isBotOpen && !hasEngaged && cooldown;
  };

  useEffect(() => {
    // 1. Return Visitor Check
    const visitCount = parseInt(localStorage.getItem('naijaShopVisitCount') || '0');
    localStorage.setItem('naijaShopVisitCount', (visitCount + 1).toString());

    if (visitCount > 0 && canTrigger()) {
      setTimeout(() => {
        if (canTrigger()) {
          openBotWithMessage(
            'Welcome back! 👋 Are you ready to start your 30-day free trial today and secure your shop records?',
            'RETURN_VISITOR'
          );
          engagementRef.current.lastTriggerTime = Date.now();
        }
      }, 3000);
    }

    // 2. Scroll Depth Trigger (> 40% depth for 8s)
    const handleScroll = () => {
      const scrollPct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (scrollPct > 0.4) {
        if (!engagementRef.current.scrollTimer && canTrigger()) {
          engagementRef.current.scrollTimer = setTimeout(() => {
            if (canTrigger()) {
              openBotWithMessage(
                'I see you are checking us out! 👀 Do you have any questions about how NaijaShop can help your business?',
                'SCROLL_DEPTH'
              );
              engagementRef.current.lastTriggerTime = Date.now();
            }
          }, 8000);
        }
      } else {
        clearTimeout(engagementRef.current.scrollTimer);
        engagementRef.current.scrollTimer = null;
      }
    };

    // 3. Exit Intent (Mouse leaves top)
    const handleExitIntent = (e: MouseEvent) => {
      if (e.clientY <= 0 && canTrigger()) {
        openBotWithMessage(
          'Wait a moment! Before you go... would you like me to show you how traders like you save 3 hours daily with NaijaShop? No commitment, just a quick chat.',
          'EXIT_INTENT'
        );
        engagementRef.current.lastTriggerTime = Date.now();
      }
    };

    // 4. Idle on Pricing Section (Intersection Observer)
    const pricingObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          engagementRef.current.pricingTimer = setTimeout(() => {
            if (canTrigger()) {
              openBotWithMessage(
                'Pricing can be confusing sometimes 😅 Would you like me to help you pick the right plan for your budget?',
                'PRICING_IDLE'
              );
              engagementRef.current.lastTriggerTime = Date.now();
            }
          }, 15000);
        } else {
          clearTimeout(engagementRef.current.pricingTimer);
        }
      },
      { threshold: 0.5 }
    );

    const pricingSection = document.getElementById('pricing-section');
    if (pricingSection) pricingObserver.observe(pricingSection);

    window.addEventListener('scroll', handleScroll);
    // Disable exit intent on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      document.addEventListener('mouseleave', handleExitIntent);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mouseleave', handleExitIntent);
      pricingObserver.disconnect();
      clearTimeout(engagementRef.current.scrollTimer);
      clearTimeout(engagementRef.current.pricingTimer);
    };
  }, [isBotOpen]);
};