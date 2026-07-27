import { describe, expect, it } from 'vitest';

import nextConfig from '@/next.config';
import { GAME_SLUGS } from '@/app/lib/constants';

describe('Next.js development configuration', () => {
  it('disables the broken Next 16.2 React debug channel reload path', () => {
    expect(nextConfig.experimental?.reactDebugChannel).toBe(false);
  });
});

describe('game hub division redirects', () => {
  it('sends every bare game URL to that game\'s Varsity hub, permanently', async () => {
    const redirects = await nextConfig.redirects!();

    expect(redirects.map((r) => r.source).sort()).toEqual(
      GAME_SLUGS.map((slug) => `/${slug}`).sort()
    );
    for (const redirect of redirects) {
      expect(redirect.destination).toBe(`${redirect.source}/varsity`);
      expect(redirect.permanent).toBe(true);
    }
  });

  it('enumerates slugs rather than matching a wildcard, so unknown games still 404', async () => {
    // `/:game` as a source would swallow every top-level path — /about, /news,
    // /apply — and forward it to a game hub that does not exist.
    for (const redirect of await nextConfig.redirects!()) {
      expect(redirect.source).not.toContain(':');
      expect(redirect.source).not.toContain('*');
    }
  });
});
