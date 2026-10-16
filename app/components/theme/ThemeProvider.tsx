'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  THEME_COLORS,
  resolveTheme,
  themeCookieAssignment,
  type ResolvedTheme,
  type ThemePreference,
} from '@/app/lib/theme';

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: 'light' | 'dark') => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * An explicit choice sets one class on `<html>`. System clears both so the
 * stylesheet's `prefers-color-scheme` rule owns the tokens. No script runs
 * before paint.
 */
export function applyThemePreference(preference: ThemePreference, resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('theme-light', preference === 'light');
  root.classList.toggle('theme-dark', preference === 'dark');
  root.style.colorScheme = preference === 'system' ? '' : resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[resolved]);
}

export function ThemeProvider({
  initialPreference,
  children,
}: {
  initialPreference: ThemePreference;
  children: React.ReactNode;
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  // The icon needs the OS when the visitor has not chosen yet. The first
  // paint uses dark for that icon only; the page colors come from CSS.
  const [systemDark, setSystemDark] = useState(true);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      const dark = media.matches;
      setSystemDark(dark);
      applyThemePreference(preference, resolveTheme(preference, dark));
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [preference]);

  const setPreference = (next: 'light' | 'dark') => {
    setPreferenceState(next);
    document.cookie = themeCookieAssignment(next, window.location.protocol === 'https:');
    applyThemePreference(next, next);
  };

  return (
    <ThemeContext.Provider
      value={{
        preference,
        resolved: resolveTheme(preference, systemDark),
        setPreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return value;
}
