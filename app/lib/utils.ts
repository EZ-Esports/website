import { SOCIAL_ICON_INITIALS } from '@/app/lib/constants';

/**
 * Gets the initial character for a social media platform.
 * First checks SOCIAL_ICON_INITIALS for a predefined initial,
 * otherwise returns the first character of the platform name (uppercased),
 * or '?' if the platform name is empty.
 */
export function getSocialIconInitial(platform: string): string {
  const normalizedPlatform = platform.toLowerCase();
  return SOCIAL_ICON_INITIALS[normalizedPlatform] || (platform.length > 0 ? platform[0].toUpperCase() : '?');
}

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
 * Sets or removes the inert attribute on the main-content element.
 * SSR-safe: only runs in browser environment.
 */
export function setMainContentInert(inert: boolean): void {
  if (typeof window === 'undefined') return;
  
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;
  
  if (inert) {
    mainContent.setAttribute('inert', '');
  } else {
    mainContent.removeAttribute('inert');
  }
}


