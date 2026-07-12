// Shared motion constants extracted from ScrollReveal.tsx and Hero.tsx so
// consumers (ScrollReveal, Hero, Header, ...) can share one source of truth
// instead of redeclaring the same easing curve and durations inline.

/** Apple-style cubic bezier used by ScrollReveal's scroll-triggered reveals. */
export const EASE_REVEAL = [0.21, 0.47, 0.32, 0.98] as const;

export const DUR = {
  fast: 0.3,
  base: 0.5,
  slow: 0.8,
} as const;
