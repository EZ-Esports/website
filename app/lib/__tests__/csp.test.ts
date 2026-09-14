import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { buildCsp, createCsp, generateCsp, updateSession } from '@/app/lib/supabase/middleware';
import { proxy } from '@/proxy';

const mockGetClaims = vi.fn();
let mockSetAllCookies: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn((_url: string, _key: string, config: { cookies?: { setAll?: (cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => void } }) => {
    if (mockSetAllCookies.length > 0 && config?.cookies?.setAll) {
      config.cookies.setAll(mockSetAllCookies);
    }
    return {
      auth: {
        getClaims: mockGetClaims,
      },
    };
  }),
}));

describe('Content-Security-Policy (CSP)', () => {
  const REQUIRED_DIRECTIVES = [
    "default-src 'self';",
    "script-src 'self' 'nonce-{{nonce}}' 'strict-dynamic' https: 'unsafe-inline';",
    "style-src 'self' 'unsafe-inline';",
    "img-src 'self' data: blob: https://*.supabase.co https://*.ytimg.com https://*.youtube.com;",
    "font-src 'self' data:;",
    "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://player.twitch.tv;",
    "connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com https://vitals.vercel-insights.com;",
    "object-src 'none';",
    "base-uri 'self';",
    "form-action 'self';",
    "frame-ancestors 'none';",
  ];

  describe('buildCsp directive construction', () => {
    it('constructs CSP containing all required security directives without unsafe-eval', () => {
      const nonce = 'dGVzdC1ub25jZQ==';
      const csp = buildCsp(nonce);

      for (const directiveTemplate of REQUIRED_DIRECTIVES) {
        const expected = directiveTemplate.replace('{{nonce}}', nonce);
        expect(csp).toContain(expected);
      }
      expect(csp).not.toContain("'unsafe-eval'");
    });

    it('interpolates different nonces correctly', () => {
      const nonceA = 'YWJjMTIz';
      const nonceB = 'eHl6Nzg5';

      const cspA = buildCsp(nonceA);
      const cspB = buildCsp(nonceB);

      expect(cspA).toContain(`'nonce-${nonceA}'`);
      expect(cspB).toContain(`'nonce-${nonceB}'`);
      expect(cspA).not.toBe(cspB);
    });

    it('aliases generateCsp and createCsp produce identical output to buildCsp', () => {
      const nonce = 'YWxpYXNUZXN0MTI=';
      expect(generateCsp(nonce)).toBe(buildCsp(nonce));
      expect(createCsp(nonce)).toBe(buildCsp(nonce));
    });
  });

  describe('updateSession middleware', () => {
    it('sets x-nonce on request headers and Content-Security-Policy on response headers', async () => {
      const req = new NextRequest('https://ez-esports.vercel.app/');
      const res = await updateSession(req);

      const requestNonce = req.headers.get('x-nonce');
      expect(requestNonce).toBeTruthy();
      expect(typeof requestNonce).toBe('string');

      // Verify the nonce is valid base64
      expect(Buffer.from(requestNonce!, 'base64').toString('base64')).toBe(requestNonce);

      // Verify Content-Security-Policy request header is set for Next.js internal script injection
      expect(req.headers.get('Content-Security-Policy')).toContain(`'nonce-${requestNonce}'`);

      const cspHeader = res.headers.get('Content-Security-Policy');
      expect(cspHeader).toBeTruthy();

      for (const directiveTemplate of REQUIRED_DIRECTIVES) {
        const expected = directiveTemplate.replace('{{nonce}}', requestNonce!);
        expect(cspHeader).toContain(expected);
      }

      // Verify x-nonce is forwarded to downstream server components via Next middleware request headers
      expect(res.headers.get('x-middleware-request-x-nonce')).toBe(requestNonce);
    });

    it('generates a unique nonce per request', async () => {
      const req1 = new NextRequest('https://ez-esports.vercel.app/valorant');
      const req2 = new NextRequest('https://ez-esports.vercel.app/about');

      const res1 = await updateSession(req1);
      const res2 = await updateSession(req2);

      const nonce1 = req1.headers.get('x-nonce');
      const nonce2 = req2.headers.get('x-nonce');

      expect(nonce1).toBeTruthy();
      expect(nonce2).toBeTruthy();
      expect(nonce1).not.toBe(nonce2);

      const csp1 = res1.headers.get('Content-Security-Policy');
      const csp2 = res2.headers.get('Content-Security-Policy');

      expect(csp1).toContain(`'nonce-${nonce1}'`);
      expect(csp2).toContain(`'nonce-${nonce2}'`);
      expect(csp1).not.toBe(csp2);
    });
  });

  describe('proxy entrypoint', () => {
    it('delegates to middleware and attaches CSP and x-nonce headers', async () => {
      const req = new NextRequest('https://ez-esports.vercel.app/schedule');
      const res = await proxy(req);

      const nonce = req.headers.get('x-nonce');
      expect(nonce).toBeTruthy();

      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toBeTruthy();
      expect(csp).toContain(`'nonce-${nonce}'`);
      expect(csp).toContain("script-src 'self' 'nonce-" + nonce + "' 'strict-dynamic' https: 'unsafe-inline';");
    });
  });

  describe('auth routes, redirects, and cookie handling', () => {
    beforeEach(() => {
      mockSetAllCookies = [];
      mockGetClaims.mockReset();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('preserves CSP headers on auth routes for unauthenticated users', async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: null } });

      const req = new NextRequest('https://ez-esports.vercel.app/admin');
      const res = await updateSession(req);

      const nonce = req.headers.get('x-nonce');
      expect(nonce).toBeTruthy();

      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toBeTruthy();
      expect(csp).toContain(`'nonce-${nonce}'`);
    });

    it('preserves CSP header and forwards refreshed session cookies on /login redirect', async () => {
      mockGetClaims.mockResolvedValue({
        data: {
          claims: { sub: 'staff-user-id', email: 'staff@ezesports.org' },
        },
      });
      mockSetAllCookies = [
        {
          name: 'sb-access-token',
          value: 'new-refreshed-token',
          options: { path: '/', httpOnly: true },
        },
      ];

      const req = new NextRequest('https://ez-esports.vercel.app/login');
      const res = await updateSession(req);

      // Verify redirect target
      expect(res.status).toBe(307);
      expect(res.headers.get('Location')).toBe('https://ez-esports.vercel.app/admin');

      // Verify CSP is preserved on redirect response
      const nonce = req.headers.get('x-nonce');
      expect(nonce).toBeTruthy();
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toBeTruthy();
      expect(csp).toContain(`'nonce-${nonce}'`);

      // Verify refreshed cookies are preserved on redirect response
      const cookie = res.cookies.get('sb-access-token');
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBe('new-refreshed-token');
    });

    it('preserves CSP headers and forwards refreshed session cookies on /admin for authenticated users', async () => {
      mockGetClaims.mockResolvedValue({
        data: {
          claims: { sub: 'admin-user-id', email: 'admin@ezesports.org' },
        },
      });
      mockSetAllCookies = [
        {
          name: 'sb-access-token',
          value: 'refreshed-admin-token',
          options: { path: '/', httpOnly: true },
        },
      ];

      const req = new NextRequest('https://ez-esports.vercel.app/admin');
      const res = await updateSession(req);

      expect(res.status).toBe(200);
      const nonce = req.headers.get('x-nonce');
      expect(nonce).toBeTruthy();
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toBeTruthy();
      expect(csp).toContain(`'nonce-${nonce}'`);

      const cookie = res.cookies.get('sb-access-token');
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBe('refreshed-admin-token');
    });
  });
});
