// ============================================================================
// DOM Utilities
// ============================================================================

/**
 * Sets or removes the aria-busy attribute on document.body.
 * SSR-safe: only runs in browser environment.
 */
export function setAriaBusy(busy: boolean): void {
  if (typeof window === 'undefined') return;
  
  if (busy) {
    document.body.setAttribute('aria-busy', 'true');
  } else {
    document.body.removeAttribute('aria-busy');
  }
}

/**
 * Sets or removes the inert attribute on the primary site elements (header, main, footer).
 * This ensures that when an overlay like the loading screen is active, users cannot
 * interact with or focus elements on the rest of the page.
 * SSR-safe: only runs in browser environment.
 */
export function setMainContentInert(inert: boolean): void {
  if (typeof window === 'undefined') return;
  
  const elements = document.querySelectorAll('header, main, footer');
  elements.forEach((el) => {
    if (inert) {
      el.setAttribute('inert', '');
    } else {
      el.removeAttribute('inert');
    }
  });
}


