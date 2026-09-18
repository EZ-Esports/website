import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mocks for the Upstash clients. Tests must never hit real network/Redis, so
// both packages are fully replaced — `limitMock` lets each test control the
// simulated Redis response (or failure).
const limitMock = vi.fn();
const redisConstructorMock = vi.fn();
const slidingWindowMock = vi.fn((limit: number, window: string) => ({ limit, window }));
const ratelimitConstructorMock = vi.fn();

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor(config: unknown) {
      redisConstructorMock(config);
    }
  },
}));

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow = slidingWindowMock;
    limit = limitMock;
    constructor(opts: unknown) {
      ratelimitConstructorMock(opts);
    }
  },
}));

const ORIGINAL_ENV = { ...process.env };

async function loadModule(env: { url?: string; token?: string }) {
  vi.resetModules();
  if (env.url === undefined) {
    delete process.env.UPSTASH_REDIS_REST_URL;
  } else {
    process.env.UPSTASH_REDIS_REST_URL = env.url;
  }
  if (env.token === undefined) {
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  } else {
    process.env.UPSTASH_REDIS_REST_TOKEN = env.token;
  }
  return import('../redis-rate-limit');
}

describe('redisRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('fails open (allows the request) when Upstash env vars are not configured', async () => {
    const { redisRateLimit } = await loadModule({ url: undefined, token: undefined });

    const result = await redisRateLimit('1.2.3.4', 5, 60_000);

    expect(result.allowed).toBe(true);
    expect(limitMock).not.toHaveBeenCalled();
    expect(redisConstructorMock).not.toHaveBeenCalled();
  });

  it('fails open when only one of the two env vars is set', async () => {
    const { redisRateLimit } = await loadModule({ url: 'https://example.upstash.io', token: undefined });

    const result = await redisRateLimit('1.2.3.4', 5, 60_000);

    expect(result.allowed).toBe(true);
    expect(redisConstructorMock).not.toHaveBeenCalled();
  });

  it('constructs a Redis client and Ratelimit instance from env vars when both are set', async () => {
    limitMock.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 60_000 });
    const { redisRateLimit } = await loadModule({
      url: 'https://example.upstash.io',
      token: 'test-token',
    });

    await redisRateLimit('1.2.3.4', 5, 60_000);

    expect(redisConstructorMock).toHaveBeenCalledWith({
      url: 'https://example.upstash.io',
      token: 'test-token',
    });
    expect(slidingWindowMock).toHaveBeenCalledWith(5, '60000 ms');
    expect(ratelimitConstructorMock).toHaveBeenCalledOnce();
  });

  it('allows the request through when Redis reports success', async () => {
    limitMock.mockResolvedValue({ success: true, remaining: 3, reset: Date.now() + 30_000 });
    const { redisRateLimit } = await loadModule({
      url: 'https://example.upstash.io',
      token: 'test-token',
    });

    const result = await redisRateLimit('1.2.3.4', 5, 60_000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
    expect(result.resetInMs).toBeGreaterThan(0);
    expect(limitMock).toHaveBeenCalledWith('1.2.3.4');
  });

  it('blocks the request when Redis reports the limit exceeded', async () => {
    limitMock.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 45_000 });
    const { redisRateLimit } = await loadModule({
      url: 'https://example.upstash.io',
      token: 'test-token',
    });

    const result = await redisRateLimit('1.2.3.4', 5, 60_000);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('fails open when the Redis call throws (outage/timeout)', async () => {
    limitMock.mockRejectedValue(new Error('ECONNRESET'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { redisRateLimit } = await loadModule({
      url: 'https://example.upstash.io',
      token: 'test-token',
    });

    const result = await redisRateLimit('1.2.3.4', 5, 60_000);

    expect(result.allowed).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('reuses a single Ratelimit instance across calls with the same limit/window', async () => {
    limitMock.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 60_000 });
    const { redisRateLimit } = await loadModule({
      url: 'https://example.upstash.io',
      token: 'test-token',
    });

    await redisRateLimit('1.2.3.4', 5, 60_000);
    await redisRateLimit('5.6.7.8', 5, 60_000);

    expect(ratelimitConstructorMock).toHaveBeenCalledOnce();
    expect(redisConstructorMock).toHaveBeenCalledOnce();
  });
});
