'use client';

import { Button } from 'react-aria-components';
import { HiOutlineMoon, HiOutlineSun } from 'react-icons/hi2';
import { useTheme } from './ThemeProvider';

/**
 * Header control. One press switches between light and dark. The first visit
 * has no cookie and follows the OS, so the icon shows whichever of those the
 * system resolved to, and the press stores the other one.
 */
export default function ThemeToggle() {
  const { resolved, setPreference } = useTheme();
  const next = resolved === 'light' ? 'dark' : 'light';
  const Icon = resolved === 'light' ? HiOutlineSun : HiOutlineMoon;

  return (
    <Button
      aria-label={next === 'dark' ? 'Switch to dark mode' : 'Switch to light mode'}
      onPress={() => setPreference(next)}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-line bg-surface-raised/40 text-foreground/90 hover:text-accent hover:bg-surface-raised cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/50 transition-colors"
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </Button>
  );
}
