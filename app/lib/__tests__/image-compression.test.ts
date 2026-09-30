import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateTargetDimensions, compressImage } from '@/app/lib/image-compression';

describe('calculateTargetDimensions', () => {
  it('preserves dimensions when both width and height are within maxDimension', () => {
    const result = calculateTargetDimensions(1920, 1080, 2048);
    expect(result).toEqual({ width: 1920, height: 1080, scaled: false });
  });

  it('preserves dimensions when exactly equal to maxDimension', () => {
    const result = calculateTargetDimensions(2048, 1536, 2048);
    expect(result).toEqual({ width: 2048, height: 1536, scaled: false });
  });

  it('scales down proportionally when width exceeds maxDimension', () => {
    const result = calculateTargetDimensions(4096, 2048, 2048);
    expect(result).toEqual({ width: 2048, height: 1024, scaled: true });
  });

  it('scales down proportionally when height exceeds maxDimension', () => {
    const result = calculateTargetDimensions(1000, 4000, 2048);
    expect(result).toEqual({ width: 512, height: 2048, scaled: true });
  });

  it('scales down square images correctly', () => {
    const result = calculateTargetDimensions(3000, 3000, 2048);
    expect(result).toEqual({ width: 2048, height: 2048, scaled: true });
  });

  it('respects custom maxDimension parameter', () => {
    const result = calculateTargetDimensions(1200, 800, 600);
    expect(result).toEqual({ width: 600, height: 400, scaled: true });
  });

  it('handles zero or negative dimensions safely', () => {
    const zeroResult = calculateTargetDimensions(0, 0, 2048);
    expect(zeroResult.width).toBeGreaterThanOrEqual(1);
    expect(zeroResult.height).toBeGreaterThanOrEqual(1);
    expect(zeroResult.scaled).toBe(false);
  });
});

describe('compressImage', () => {
  it('preserves GIFs untouched to avoid stripping animation frames', async () => {
    const gifFile = new File([new Uint8Array([71, 73, 70, 56])], 'animation.gif', {
      type: 'image/gif',
    });
    const result = await compressImage(gifFile);
    expect(result).toBe(gifFile);
  });

  it('bypasses non-image files untouched', async () => {
    const textFile = new File(['hello world'], 'doc.txt', { type: 'text/plain' });
    const result = await compressImage(textFile);
    expect(result).toBe(textFile);
  });

  it('gracefully returns original file in non-browser (Node) environment without throwing', async () => {
    const file = new File([new Uint8Array(5000)], 'test.jpg', { type: 'image/jpeg' });
    const result = await compressImage(file);
    expect(result).toBe(file);
  });

  describe('with browser DOM mocks', () => {
    let originalWindow: typeof globalThis.window;
    let originalDocument: typeof globalThis.document;

    beforeEach(() => {
      originalWindow = globalThis.window;
      originalDocument = globalThis.document;
    });

    afterEach(() => {
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
      vi.restoreAllMocks();
    });

    it('scales oversized image down and returns compressed File', async () => {
      const mockBlob = new Blob([new Uint8Array(1000)], { type: 'image/jpeg' });
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
        }),
        toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
          callback(mockBlob);
        }),
      };

      class MockImage {
        width = 4000;
        height = 3000;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_val: string) {
          setTimeout(() => this.onload && this.onload(), 0);
        }
      }

      (globalThis as unknown as { window: unknown }).window = {
        Image: MockImage,
      };

      (globalThis as unknown as { document: unknown }).document = {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      };

      const createObjectURL = vi.fn().mockReturnValue('blob:test');
      const revokeObjectURL = vi.fn();
      globalThis.URL.createObjectURL = createObjectURL;
      globalThis.URL.revokeObjectURL = revokeObjectURL;

      const largeFile = new File([new Uint8Array(6 * 1024 * 1024)], 'large-photo.jpg', {
        type: 'image/jpeg',
      });

      const compressed = await compressImage(largeFile, { maxDimension: 2048 });

      expect(mockCanvas.width).toBe(2048);
      expect(mockCanvas.height).toBe(1536);
      expect(compressed.name).toBe('large-photo.jpg');
      expect(compressed.type).toBe('image/jpeg');
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    });

    it('falls back to original file if canvas context is unavailable', async () => {
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(null),
      };

      class MockImage {
        width = 3000;
        height = 2000;
        onload: (() => void) | null = null;
        set src(_val: string) {
          setTimeout(() => this.onload && this.onload(), 0);
        }
      }

      (globalThis as unknown as { window: unknown }).window = { Image: MockImage };
      (globalThis as unknown as { document: unknown }).document = { createElement: vi.fn().mockReturnValue(mockCanvas) };
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      globalThis.URL.revokeObjectURL = vi.fn();

      const originalFile = new File([new Uint8Array(1000)], 'photo.png', {
        type: 'image/png',
      });

      const result = await compressImage(originalFile);
      expect(result).toBe(originalFile);
    });

    it('falls back to original file if image fails to load', async () => {
      class FailingImage {
        onerror: (() => void) | null = null;
        set src(_val: string) {
          setTimeout(() => this.onerror && this.onerror(), 0);
        }
      }

      (globalThis as unknown as { window: unknown }).window = { Image: FailingImage };
      (globalThis as unknown as { document: unknown }).document = { createElement: vi.fn() };
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      globalThis.URL.revokeObjectURL = vi.fn();

      const corruptedFile = new File([new Uint8Array(100)], 'corrupt.jpg', {
        type: 'image/jpeg',
      });

      const result = await compressImage(corruptedFile);
      expect(result).toBe(corruptedFile);
    });
  });
});
