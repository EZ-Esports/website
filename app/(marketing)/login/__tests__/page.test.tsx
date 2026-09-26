import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LoginPage, { DEFAULT_ERROR_MESSAGE, ERROR_MAP, MESSAGE_MAP } from '../page';

describe('LoginPage (/login)', () => {
  describe('lookup tables', () => {
    it('defines a safe, generic default fallback error message', () => {
      expect(DEFAULT_ERROR_MESSAGE).toBe('Sign in failed. Please try again.');
    });

    it('maps known error strings from login actions to fixed copy', () => {
      expect(ERROR_MAP['Email and password are required.']).toBe(
        'Email and password are required.'
      );
      expect(
        ERROR_MAP['Too many login attempts. Please try again in 15 minutes.']
      ).toBe('Too many login attempts. Please try again in 15 minutes.');
      expect(ERROR_MAP['Invalid login credentials']).toBe(
        'Invalid login credentials.'
      );
      expect(ERROR_MAP['Sign-in failed. Please try again.']).toBe(
        'Sign in failed. Please try again.'
      );
    });

    it('maps known message keys to fixed copy', () => {
      expect(MESSAGE_MAP['account-created']).toBe(
        'Account created. Please sign in.'
      );
    });
  });

  describe('rendering behavior', () => {
    it('renders the login form without alerts when no query params are present', async () => {
      const page = await LoginPage({ searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(page);

      expect(html).toContain('Staff Portal');
      expect(html).toContain('Email Address');
      expect(html).toContain('Password');
      expect(html).not.toContain('role="alert"');
      expect(html).not.toContain('role="status"');
    });

    it('renders legitimate known errors with the corresponding fixed copy', async () => {
      const knownErrors = [
        {
          param: 'Email and password are required.',
          expected: 'Email and password are required.',
        },
        {
          param: 'Too many login attempts. Please try again in 15 minutes.',
          expected: 'Too many login attempts. Please try again in 15 minutes.',
        },
        {
          param: 'Invalid login credentials',
          expected: 'Invalid login credentials.',
        },
        {
          param: 'invalid-credentials',
          expected: 'Invalid login credentials.',
        },
        {
          param: 'rate-limited',
          expected: 'Too many login attempts. Please try again in 15 minutes.',
        },
      ];

      for (const { param, expected } of knownErrors) {
        const page = await LoginPage({
          searchParams: Promise.resolve({ error: param }),
        });
        const html = renderToStaticMarkup(page);

        expect(html).toContain('role="alert"');
        expect(html).toContain(expected);
      }
    });

    it('does NOT reflect arbitrary / malicious strings from ?error= into the alert', async () => {
      const maliciousPayloads = [
        '<svg/onload=alert(1)>',
        'Your password was reset, call 555-0199 for support',
        '<script>alert("xss")</script>',
        'javascript:void(0)',
        'random_unrecognized_error_string',
      ];

      for (const payload of maliciousPayloads) {
        const page = await LoginPage({
          searchParams: Promise.resolve({ error: payload }),
        });
        const html = renderToStaticMarkup(page);

        // Crucial security assertions: untrusted raw string must NOT appear anywhere in the rendered HTML
        expect(html).not.toContain(payload);
        expect(html).not.toContain('onload=alert(1)');
        expect(html).not.toContain('555-0199');
        expect(html).not.toContain('alert("xss")');
        expect(html).not.toContain('random_unrecognized_error_string');

        // It must safely fall back to the generic constant copy inside the alert span
        expect(html).toContain('role="alert"');
        expect(html).toContain(`<span>${DEFAULT_ERROR_MESSAGE}</span>`);
      }
    });

    it('renders legitimate success message for known message keys', async () => {
      const page = await LoginPage({
        searchParams: Promise.resolve({ message: 'account-created' }),
      });
      const html = renderToStaticMarkup(page);

      expect(html).toContain('role="status"');
      expect(html).toContain('Account created. Please sign in.');
      expect(html).not.toContain('role="alert"');
    });

    it('does NOT reflect arbitrary strings from ?message=', async () => {
      const page = await LoginPage({
        searchParams: Promise.resolve({ message: '<script>phish</script>' }),
      });
      const html = renderToStaticMarkup(page);

      expect(html).not.toContain('<script>phish</script>');
      expect(html).not.toContain('role="status"');
    });

    it('suppresses success message when an error is present', async () => {
      const page = await LoginPage({
        searchParams: Promise.resolve({
          message: 'account-created',
          error: 'invalid-credentials',
        }),
      });
      const html = renderToStaticMarkup(page);

      expect(html).toContain('role="alert"');
      expect(html).toContain('Invalid login credentials.');
      expect(html).not.toContain('role="status"');
      expect(html).not.toContain('Account created. Please sign in.');
    });
  });
});
