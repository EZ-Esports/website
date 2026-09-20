import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GalleryManagerClient, {
  deriveDisplayImages,
  moveItem,
  GalleryImage,
} from '../GalleryManagerClient';

// Mock dependencies
vi.mock('@/app/(admin)/admin/gallery/actions', () => ({
  updateGalleryImagesOrder: vi.fn(),
  updateGalleryImage: vi.fn(),
  toggleGalleryImageActive: vi.fn(),
  deleteGalleryImage: vi.fn(),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

describe('GalleryManagerClient unit & integration tests', () => {
  const sampleImages: GalleryImage[] = [
    {
      id: 'img-1',
      src: '/img1.png',
      storageKey: 'key1',
      caption: 'Image 1',
      schoolName: 'School 1',
      eventName: 'Event 1',
      displayOrder: 1,
      isActive: true,
    },
    {
      id: 'img-2',
      src: '/img2.png',
      storageKey: 'key2',
      caption: 'Image 2',
      schoolName: 'School 2',
      eventName: 'Event 2',
      displayOrder: 2,
      isActive: true,
    },
    {
      id: 'img-3',
      src: '/img3.png',
      storageKey: 'key3',
      caption: 'Image 3',
      schoolName: 'School 3',
      eventName: 'Event 3',
      displayOrder: 3,
      isActive: false,
    },
  ];

  describe('moveItem helper', () => {
    it('moves an item forward in the array', () => {
      const items = ['a', 'b', 'c', 'd'];
      expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    });

    it('moves an item backward in the array', () => {
      const items = ['a', 'b', 'c', 'd'];
      expect(moveItem(items, 2, 0)).toEqual(['c', 'a', 'b', 'd']);
    });
  });

  describe('deriveDisplayImages', () => {
    it('returns initialImages directly when draftOrder is null', () => {
      const result = deriveDisplayImages(sampleImages, null);
      expect(result).toBe(sampleImages);
    });

    it('orders images according to draftOrder', () => {
      const draftOrder = ['img-3', 'img-1', 'img-2'];
      const result = deriveDisplayImages(sampleImages, draftOrder);
      expect(result.map((img) => img.id)).toEqual(['img-3', 'img-1', 'img-2']);
    });

    it('reflects updated server props (e.g. caption, active state) while preserving draft order', () => {
      const draftOrder = ['img-2', 'img-1', 'img-3'];

      // Simulate server update with changed caption and isActive for img-1
      const updatedServerImages: GalleryImage[] = [
        {
          ...sampleImages[0],
          caption: 'Updated Image 1 Caption',
          isActive: false,
        },
        sampleImages[1],
        sampleImages[2],
      ];

      const result = deriveDisplayImages(updatedServerImages, draftOrder);

      // Order is preserved from draft
      expect(result.map((img) => img.id)).toEqual(['img-2', 'img-1', 'img-3']);

      // Updated fields from server are present
      const img1 = result.find((img) => img.id === 'img-1');
      expect(img1?.caption).toBe('Updated Image 1 Caption');
      expect(img1?.isActive).toBe(false);
    });

    it('drops deleted images that are in draftOrder but no longer in initialImages', () => {
      const draftOrder = ['img-3', 'img-2', 'img-1'];

      // Simulate deletion of img-2 on server
      const updatedServerImages = [sampleImages[0], sampleImages[2]];

      const result = deriveDisplayImages(updatedServerImages, draftOrder);

      // img-2 dropped, remaining draft order preserved
      expect(result.map((img) => img.id)).toEqual(['img-3', 'img-1']);
    });

    it('appends newly added images from server that are not in draftOrder', () => {
      const draftOrder = ['img-2', 'img-1', 'img-3'];

      const newImage: GalleryImage = {
        id: 'img-4',
        src: '/img4.png',
        storageKey: 'key4',
        caption: 'New Image 4',
        schoolName: 'School 4',
        eventName: 'Event 4',
        displayOrder: 4,
        isActive: true,
      };

      const updatedServerImages = [...sampleImages, newImage];

      const result = deriveDisplayImages(updatedServerImages, draftOrder);

      // Preserves draft order and appends new image
      expect(result.map((img) => img.id)).toEqual(['img-2', 'img-1', 'img-3', 'img-4']);
      expect(result[3].caption).toBe('New Image 4');
    });

    it('handles duplicate IDs defensively without creating duplicate entries', () => {
      const draftOrder = ['img-2', 'img-1', 'img-2', 'img-3'];
      const result = deriveDisplayImages(sampleImages, draftOrder);
      expect(result.map((img) => img.id)).toEqual(['img-2', 'img-1', 'img-3']);
    });

    it('resets to authoritative server state when draftOrder is cleared back to null after reordering', () => {
      const draftOrder = ['img-3', 'img-1', 'img-2'];
      const reordered = deriveDisplayImages(sampleImages, draftOrder);
      expect(reordered.map((img) => img.id)).toEqual(['img-3', 'img-1', 'img-2']);

      // Simulates handleReset / Discard restoring server state
      const reset = deriveDisplayImages(sampleImages, null);
      expect(reset).toBe(sampleImages);
      expect(reset.map((img) => img.id)).toEqual(['img-1', 'img-2', 'img-3']);
    });
  });

  describe('rendering', () => {
    it('renders initial list without unsaved changes banner when not dirty', () => {
      const html = renderToStaticMarkup(<GalleryManagerClient initialImages={sampleImages} />);

      expect(html).toContain('Image 1');
      expect(html).toContain('Image 2');
      expect(html).toContain('Image 3');
      expect(html).not.toContain('Unsaved order changes');
    });
  });
});
