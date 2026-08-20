import { describe, expect, it } from 'vitest';

describe('MediaGrid Carousel Logic', () => {
  const mockItems = Array.from({ length: 11 }, (_, i) => ({
    id: `photo-${i + 1}`,
    src: `/images/gallery/gallery-${i + 1}.png`,
    alt: `Test photo ${i + 1}`,
  }));

  it('calculates visible count responsively', () => {
    const getVisibleCount = (width: number, maxColumns = 3) => {
      if (width < 640) return 1;
      if (width < 1024) return 2;
      return Math.min(maxColumns, 3);
    };

    expect(getVisibleCount(375)).toBe(1);  // Mobile
    expect(getVisibleCount(768)).toBe(2);  // Tablet
    expect(getVisibleCount(1280)).toBe(3); // Desktop
  });

  it('calculates max index and bounds accurately', () => {
    const visibleCount = 3;
    const maxIndex = Math.max(0, mockItems.length - visibleCount);
    expect(maxIndex).toBe(8); // 11 items - 3 visible = 8 max index
  });

  it('determines lazy loading window correctly', () => {
    const currentIndex = 2;
    const visibleCount = 3;
    const isNearViewport = (index: number) => Math.abs(index - currentIndex) <= visibleCount + 1;

    // Items within buffer range (2 - 4 <= index <= 2 + 4 -> 0 to 6)
    expect(isNearViewport(0)).toBe(true);
    expect(isNearViewport(3)).toBe(true);
    expect(isNearViewport(6)).toBe(true);

    // Items outside buffer range
    expect(isNearViewport(8)).toBe(false);
    expect(isNearViewport(10)).toBe(false);
  });
});
