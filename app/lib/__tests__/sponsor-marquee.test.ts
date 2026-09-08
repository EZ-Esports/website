import { describe, expect, it } from 'vitest';
import { padSponsors, type MarqueeSponsor } from '@/app/(marketing)/sponsors/SponsorMarquee';

describe('SponsorMarquee Logic', () => {
  const mockSponsors: MarqueeSponsor[] = [
    { id: '1', name: 'Alpha Corp', logoUrl: '/images/sponsors/alpha.png' },
    { id: '2', name: 'Beta Gaming', logoUrl: null },
    { id: '3', name: 'Gamma Gear', logoUrl: '/images/sponsors/gamma.png' },
  ];

  it('returns an empty array when given an empty list', () => {
    expect(padSponsors([])).toEqual([]);
  });

  it('returns an empty array when given null or undefined', () => {
    expect(padSponsors(null)).toEqual([]);
    expect(padSponsors(undefined)).toEqual([]);
    expect(padSponsors()).toEqual([]);
  });

  it('pads small lists to at least 32 items with multiple repetitions by default', () => {
    const single = [{ id: '1', name: 'Solo Sponsor', logoUrl: null }];
    const paddedSingle = padSponsors(single);
    expect(paddedSingle.length).toBe(32);
    expect(paddedSingle.length).toBeGreaterThanOrEqual(32);
    expect(paddedSingle.every((s) => s.id === '1')).toBe(true);

    const paddedThree = padSponsors(mockSponsors);
    expect(paddedThree.length).toBe(33); // Math.ceil(32 / 3) = 11, 11 * 3 = 33
    expect(paddedThree.length).toBeGreaterThanOrEqual(32);
    expect(paddedThree[0]?.name).toBe('Alpha Corp');
    expect(paddedThree[1]?.name).toBe('Beta Gaming');
    expect(paddedThree[2]?.name).toBe('Gamma Gear');
    expect(paddedThree[3]?.name).toBe('Alpha Corp');
  });

  it('ensures at least 2 repetitions even for lists that meet or exceed minLength', () => {
    const thirtyTwoSponsors: MarqueeSponsor[] = Array.from({ length: 32 }, (_, i) => ({
      id: `sp-${i + 1}`,
      name: `Sponsor ${i + 1}`,
      logoUrl: null,
    }));

    const paddedThirtyTwo = padSponsors(thirtyTwoSponsors);
    expect(paddedThirtyTwo.length).toBe(64); // Math.max(2, Math.ceil(32/32)) * 32 = 64
    expect(paddedThirtyTwo[0]?.id).toBe('sp-1');
    expect(paddedThirtyTwo[32]?.id).toBe('sp-1');

    const fortySponsors: MarqueeSponsor[] = Array.from({ length: 40 }, (_, i) => ({
      id: `sp-${i + 1}`,
      name: `Sponsor ${i + 1}`,
      logoUrl: null,
    }));

    const paddedForty = padSponsors(fortySponsors);
    expect(paddedForty.length).toBe(80); // Math.max(2, Math.ceil(32/40)) * 40 = 80
    expect(paddedForty[0]?.id).toBe('sp-1');
    expect(paddedForty[40]?.id).toBe('sp-1');
  });

  it('supports custom minLength parameter', () => {
    const paddedCustom = padSponsors(mockSponsors, 12);
    expect(paddedCustom.length).toBe(12);
  });
});
