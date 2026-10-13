import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_BOOT_SCRIPT,
  THEME_COOKIE,
  parseThemePreference,
  resolveTheme,
  themeClassFor,
  themeCookieAssignment,
} from '@/app/lib/theme';

describe('parseThemePreference', () => {
  it('accepts the three stored choices', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('system')).toBe('system');
  });

  it('falls back to dark for a missing or unknown cookie', () => {
    expect(parseThemePreference(null)).toBe(DEFAULT_THEME_PREFERENCE);
    expect(parseThemePreference(undefined)).toBe('dark');
    expect(parseThemePreference('')).toBe('dark');
    expect(parseThemePreference('Light')).toBe('dark');
    expect(parseThemePreference('auto')).toBe('dark');
  });
});

describe('resolveTheme', () => {
  it('lets an explicit choice win over the OS', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('follows the OS only for system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('themeClassFor', () => {
  it('adds the light class only for the light appearance', () => {
    expect(themeClassFor('light')).toBe('theme-light');
    expect(themeClassFor('dark')).toBeUndefined();
  });
});

describe('themeCookieAssignment', () => {
  it('writes a year-long cookie and marks it Secure only on https', () => {
    const plain = themeCookieAssignment('light', false);
    expect(plain.startsWith(`${THEME_COOKIE}=light;`)).toBe(true);
    expect(plain).toContain('Path=/');
    expect(plain).toContain('Max-Age=31536000');
    expect(plain).toContain('SameSite=Lax');
    expect(plain).not.toContain('Secure');
    expect(themeCookieAssignment('system', true)).toContain('; Secure');
  });
});

describe('THEME_BOOT_SCRIPT', () => {
  it('reads the same cookie and the same three choices the server parser accepts', () => {
    expect(THEME_BOOT_SCRIPT).toContain(THEME_COOKIE);
    expect(THEME_BOOT_SCRIPT).toContain('"light"');
    expect(THEME_BOOT_SCRIPT).toContain('"dark"');
    expect(THEME_BOOT_SCRIPT).toContain('"system"');
    expect(THEME_BOOT_SCRIPT).toContain('prefers-color-scheme: dark');
    expect(THEME_BOOT_SCRIPT).toContain('theme-light');
  });
});
