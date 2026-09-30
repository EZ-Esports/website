import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LoginPage, { MESSAGE_MAP } from '../page';

describe('LoginPage (/login)', () => {
  describe('lookup tables', () => {
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

    it('does NOT reflect arbitrary or malicious strings from ?error= (decoupled from URL)', async () => {
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

        // Security assertion: ?error= is no longer rendered into the DOM at all
        expect(html).not.toContain(payload);
        expect(html).not.toContain('onload=alert(1)');
        expect(html).not.toContain('555-0199');
        expect(html).not.toContain('alert("xss")');
        expect(html).not.toContain('random_unrecognized_error_string');
        expect(html).not.toContain('role="alert"');
      }
    });
  });
});
