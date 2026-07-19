import { describe, expect, it } from 'vitest';

import nextConfig from '@/next.config';

describe('Next.js development configuration', () => {
  it('disables the broken Next 16.2 React debug channel reload path', () => {
    expect(nextConfig.experimental?.reactDebugChannel).toBe(false);
  });
});
