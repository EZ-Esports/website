import { describe, expect, it } from 'vitest';

describe('MediaGrid Dual Marquee Logic', () => {
  const mockItems = Array.from({ length: 11 }, (_, i) => ({
    id: `photo-${i + 1}`,
    src: `/images/gallery/gallery-${i + 1}.png`,
    alt: `Test photo ${i + 1}`,
  }));

  it('splits items evenly into dual rows preserving original indices', () => {
    const indexedItems = mockItems.map((item, originalIndex) => ({
      ...item,
      originalIndex,
    }));

    const row1 = indexedItems.filter((_, i) => i % 2 === 0);
    const row2 = indexedItems.filter((_, i) => i % 2 !== 0);

    expect(row1.length).toBe(6);
    expect(row2.length).toBe(5);
    expect(row1[0]!.originalIndex).toBe(0);
    expect(row2[0]!.originalIndex).toBe(1);
  });

  it('fills tracks to minimum count for seamless loop repetition', () => {
    function prepareTrackItems<T>(row: T[], minCount = 8): T[] {
      if (row.length === 0) return [];
      const repetitions = Math.ceil(minCount / row.length);
      return Array.from({ length: repetitions }, () => row).flat();
    }

    const shortList = [mockItems[0]!, mockItems[1]!];
    const filled = prepareTrackItems(shortList, 8);
    expect(filled.length).toBe(8);

    const normalRow = mockItems.slice(0, 6);
    const filledNormal = prepareTrackItems(normalRow, 8);
    expect(filledNormal.length).toBe(12); // 6 * 2 = 12 >= 8
  });
});

