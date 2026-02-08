import { useState, useEffect } from 'react';

/**
 * Hook to detect user's prefers-reduced-motion preference.
 * Returns true if the user prefers reduced motion, false otherwise.
 * SSR-safe: defaults to false during SSR.
 */
export function usePrefersReducedMotion(forced?: boolean): boolean {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    // If forced value is provided, use it
    if (forced !== undefined) return forced;
    
    // During SSR, default to false
    if (typeof window === 'undefined') return false;
    
    // Check initial preference
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  });

  useEffect(() => {
    // If forced value is provided, don't listen to changes
    if (forced !== undefined) return;
    
    // SSR check
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    // Update state when preference changes
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setPrefersReduced(e.matches);
    };
    
    // Modern browsers support addEventListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [forced]);

  return prefersReduced;
}
