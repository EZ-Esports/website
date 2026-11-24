export const THEME_COOKIE = 'ez-theme';

export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export type ResolvedTheme = 'light' | 'dark';

/**
 * No cookie means follow the operating system. Light and dark are explicit
 * choices the header toggle writes. `system` is accepted so an older cookie
 * still means "no explicit choice."
 */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#ffffff',
  dark: '#111111',
};

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  if (value === 'light' || value === 'dark') return value;
  return DEFAULT_THEME_PREFERENCE;
}

/** `system` follows the OS. An explicit light or dark choice wins. */
export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

/**
 * Class on `<html>`. System leaves both off so the `prefers-color-scheme`
 * rule in `globals.css` can paint the right tokens without a script.
 * `theme-dark` here is the explicit dark choice; the same class on a
 * subtree still pins that subtree to the dark tokens.
 */
export function htmlThemeClass(preference: ThemePreference): 'theme-light' | 'theme-dark' | undefined {
  if (preference === 'light') return 'theme-light';
  if (preference === 'dark') return 'theme-dark';
  return undefined;
}

export function themeCookieAssignment(preference: 'light' | 'dark', secure: boolean): string {
  const secureFlag = secure ? '; Secure' : '';
  return `${THEME_COOKIE}=${preference}; Path=/; Max-Age=31536000; SameSite=Lax${secureFlag}`;
}
