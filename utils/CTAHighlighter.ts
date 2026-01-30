/**
 * Utility to trigger visual highlights on the main Call To Action buttons
 */
export type HighlightIntensity = 'subtle' | 'strong' | 'urgent';

export const triggerTryOnHighlight = (intensity: HighlightIntensity) => {
  // Find the primary CTA
  const cta = document.querySelector('[data-cta="primary"]') || 
              document.querySelector('.hero-cta') ||
              Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Trial'));

  if (!cta) return;

  const btn = cta as HTMLElement;
  const originalText = btn.innerText;

  // Cleanup function to remove all highlighting artifacts
  const cleanup = () => {
    btn.classList.remove('pulse-subtle', 'pulse-strong', 'shake-urgent');
    const existingArrow = document.getElementById('cta-highlight-arrow');
    if (existingArrow) existingArrow.remove();
    btn.innerText = originalText;
  };

  // Ensure button is visible but don't force scroll if chat is covering it on mobile
  if (window.innerWidth > 768) {
    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Immediate actions based on intensity
  switch (intensity) {
    case 'subtle':
      btn.classList.add('pulse-subtle');
      break;

    case 'strong':
      btn.classList.add('pulse-strong');
      
      // Create a temporary floating arrow
      const arrow = document.createElement('div');
      arrow.id = 'cta-highlight-arrow';
      arrow.innerHTML = '⬇️';
      arrow.style.position = 'absolute';
      arrow.style.fontSize = '32px';
      arrow.style.pointerEvents = 'none';
      arrow.classList.add('floating-arrow');
      
      // Position arrow above button
      document.body.appendChild(arrow);
      const updatePosition = () => {
        const rect = btn.getBoundingClientRect();
        arrow.style.top = `${window.scrollY + rect.top - 50}px`;
        arrow.style.left = `${rect.left + rect.width / 2 - 16}px`;
        arrow.style.zIndex = '9999';
      };
      
      updatePosition();
      window.addEventListener('resize', updatePosition);
      setTimeout(() => window.removeEventListener('resize', updatePosition), 5000);
      break;

    case 'urgent':
      btn.classList.add('shake-urgent');
      btn.innerText = '👆 Click Here Now!';
      
      // Text revert after 3 seconds
      setTimeout(() => {
        btn.innerText = originalText;
      }, 3000);
      break;
  }

  // Final cleanup after 5 seconds
  setTimeout(cleanup, 5000);
};