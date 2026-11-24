import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_COOKIE,
  htmlThemeClass,
  parseThemePreference,
  resolveTheme,
  themeCookieAssignment,
} from '@/app/lib/theme';

describe('parseThemePreference', () => {
  it('accepts an explicit light or dark choice', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
  });

  it('treats a missing, system, or unknown cookie as follow-the-OS', () => {
    expect(parseThemePreference(null)).toBe(DEFAULT_THEME_PREFERENCE);
    expect(parseThemePreference(undefined)).toBe('system');
    expect(parseThemePreference('')).toBe('system');
    expect(parseThemePreference('system')).toBe('system');
    expect(parseThemePreference('Light')).toBe('system');
    expect(parseThemePreference('auto')).toBe('system');
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

describe('htmlThemeClass', () => {
  it('sets a class only for an explicit choice', () => {
    expect(htmlThemeClass('light')).toBe('theme-light');
    expect(htmlThemeClass('dark')).toBe('theme-dark');
    expect(htmlThemeClass('system')).toBeUndefined();
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
    expect(themeCookieAssignment('dark', true)).toContain('; Secure');
  });
});
