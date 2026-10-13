export const THEME_COOKIE = 'ez-theme';

export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export type ResolvedTheme = 'light' | 'dark';

/**
 * Visitors who have never chosen keep the site's designed dark appearance.
 * `system` is an explicit choice, not the default.
 */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark';

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#ffffff',
  dark: '#111111',
};

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return DEFAULT_THEME_PREFERENCE;
}

/** `system` follows the OS. An explicit light or dark choice wins. */
export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

/** Class that opts an element into the light token set in `globals.css`. */
export function themeClassFor(resolved: ResolvedTheme): 'theme-light' | undefined {
  return resolved === 'light' ? 'theme-light' : undefined;
}

export function themeCookieAssignment(preference: ThemePreference, secure: boolean): string {
  const secureFlag = secure ? '; Secure' : '';
  return `${THEME_COOKIE}=${preference}; Path=/; Max-Age=31536000; SameSite=Lax${secureFlag}`;
}

/**
 * Runs before first paint. Must stay equivalent to `parseThemePreference` +
 * `resolveTheme`: the server can render an explicit light or dark choice, but
 * only the browser knows what `system` resolves to. A mismatch here flashes
 * the wrong surface before hydration.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);var p=m?decodeURIComponent(m[1]):"${DEFAULT_THEME_PREFERENCE}";if(p!=="light"&&p!=="dark"&&p!=="system")p="${DEFAULT_THEME_PREFERENCE}";var dark=window.matchMedia("(prefers-color-scheme: dark)").matches;var resolved=p==="system"?(dark?"dark":"light"):p;var light=resolved==="light";document.documentElement.classList.toggle("theme-light",light);document.documentElement.style.colorScheme=resolved;var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content",light?"${THEME_COLORS.light}":"${THEME_COLORS.dark}");}catch(e){}})();`;
