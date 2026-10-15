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
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Applies the resolved appearance on `<html>` so every token underneath follows. */
export function applyResolvedTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('theme-light', resolved === 'light');
  root.style.colorScheme = resolved;
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
  // Dark until the effect reads the OS. The boot script has already painted
  // the correct class; this state only drives the control's icon.
  const [systemDark, setSystemDark] = useState(true);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      const dark = media.matches;
      setSystemDark(dark);
      applyResolvedTheme(resolveTheme(preference, dark));
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [preference]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    document.cookie = themeCookieAssignment(next, window.location.protocol === 'https:');
    applyResolvedTheme(resolveTheme(next, systemPrefersDark()));
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
