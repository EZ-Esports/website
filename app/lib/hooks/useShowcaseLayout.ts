'use client';

import { useMemo } from 'react';

/**
 * Derives responsive width classes for showcase items based on total item count.
 * Formats multiples of 3 into a 3-column desktop layout, and other counts (e.g. 4)
 * into a balanced 2-column grid.
 */
export function getShowcaseLayoutClass(totalItems: number): string {
  if (totalItems <= 0) return 'w-full';
  if (totalItems % 3 === 0) {
    return 'sm:w-[calc(50%_-_1rem)] lg:w-[calc(33.333%_-_1.333rem)]';
  }
  return 'sm:w-[calc(50%_-_1rem)] lg:w-[calc(50%_-_1rem)]';
}

/**
 * React hook wrapper around getShowcaseLayoutClass memoizing the layout decision.
 */
export function useShowcaseLayout(totalItems: number): string {
  return useMemo(() => getShowcaseLayoutClass(totalItems), [totalItems]);
}
