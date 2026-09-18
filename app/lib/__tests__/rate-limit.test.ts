import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import the module so we can access the internal store for reset between tests.
// Because the store is module-level, we need fresh isolation per test.
let rateLimitModule: typeof import('../rate-limit');

beforeEach(async () => {
  vi.resetModules();
  rateLimitModule = await import('../rate-limit');
});

describe('rateLimit', () => {
  it('allows requests within the limit', () => {
    const { rateLimit } = rateLimitModule;
    const r1 = rateLimit('ip-1', 3);
    const r2 = rateLimit('ip-1', 3);
    const r3 = rateLimit('ip-1', 3);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('blocks the request that exceeds the limit', () => {
    const { rateLimit } = rateLimitModule;
    rateLimit('ip-2', 2);
    rateLimit('ip-2', 2);
    const r = rateLimit('ip-2', 2);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('tracks different IPs independently', () => {
    const { rateLimit } = rateLimitModule;
    rateLimit('ip-a', 1);
    const blocked = rateLimit('ip-a', 1);
    const allowed = rateLimit('ip-b', 1);
    expect(blocked.allowed).toBe(false);
    expect(allowed.allowed).toBe(true);
  });

  it('exposes a positive resetInMs when blocked', () => {
    const { rateLimit } = rateLimitModule;
    rateLimit('ip-3', 1);
    const r = rateLimit('ip-3', 1);
    expect(r.allowed).toBe(false);
    expect(r.resetInMs).toBeGreaterThan(0);
  });

  it('allows the request once the window has passed', async () => {
    const { rateLimit } = rateLimitModule;
    const WINDOW = 50; // tiny 50 ms window for test speed
    rateLimit('ip-4', 1, WINDOW);
    const blocked = rateLimit('ip-4', 1, WINDOW);
    expect(blocked.allowed).toBe(false);

    await new Promise(r => setTimeout(r, WINDOW + 10));

    const allowed = rateLimit('ip-4', 1, WINDOW);
    expect(allowed.allowed).toBe(true);
  });
});

describe('getClientIp', () => {
  it('does not let a spoofed, client-prepended leading x-forwarded-for entry change the derived IP', () => {
    const { getClientIp } = rateLimitModule;
    // A client can freely set everything before the last hop; '9.9.9.9' here
    // stands in for an attacker trying to disguise their rate-limit identity.
    const spoofed = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '9.9.9.9, 5.6.7.8' },
    });
    const notSpoofed = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getClientIp(spoofed)).not.toBe('9.9.9.9');
    expect(getClientIp(spoofed)).toBe(getClientIp(notSpoofed));
  });

  it('uses the last entry of a multi-hop x-forwarded-for chain', () => {
    const { getClientIp } = rateLimitModule;
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1, 5.6.7.8' },
    });
    expect(getClientIp(req)).toBe('5.6.7.8');
  });

  it('prefers x-real-ip over x-forwarded-for when both are present', () => {
    const { getClientIp } = rateLimitModule;
    const req = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
        'x-real-ip': '9.10.11.12',
      },
    });
    expect(getClientIp(req)).toBe('9.10.11.12');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const { getClientIp } = rateLimitModule;
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '9.10.11.12' },
    });
    expect(getClientIp(req)).toBe('9.10.11.12');
  });

  it('returns "unknown" when no IP header is present', () => {
    const { getClientIp } = rateLimitModule;
    const req = new Request('http://localhost');
    expect(getClientIp(req)).toBe('unknown');
  });
});
