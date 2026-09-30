import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GalleryGrid from '@/app/(marketing)/gallery/GalleryGrid';
import MediaGrid from '@/app/components/sections/MediaGrid';
import SponsorMarquee from '@/app/(marketing)/sponsors/SponsorMarquee';
import type { Image as ImageType } from '@/app/types';

describe('Media and Gallery responsive sizes & optimization (Issue #192)', () => {
  const mockImages: ImageType[] = [
    { id: '1', src: '/images/gallery/test-1.png', alt: 'Test Photo 1' },
    { id: '2', src: '/images/gallery/test-2.png', alt: 'Test Photo 2' },
  ];

  describe('GalleryGrid.tsx', () => {
    it('sets responsive sizes on photo cards to mitigate mobile bandwidth egress', () => {
      const html = renderToStaticMarkup(<GalleryGrid items={mockImages} />);
      expect(html).toContain('sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 320px"');
    });

    it('ensures GalleryGrid does not bypass Next.js image optimization with unoptimized', () => {
      const fileContent = readFileSync(
        resolve(process.cwd(), 'app/(marketing)/gallery/GalleryGrid.tsx'),
        'utf8',
      );
      expect(fileContent).not.toContain('unoptimized');
    });

    it('configures lightbox image with responsive sizes capped at 1024px', () => {
      const fileContent = readFileSync(
        resolve(process.cwd(), 'app/(marketing)/gallery/GalleryGrid.tsx'),
        'utf8',
      );
      expect(fileContent).toContain('sizes="(max-width: 1024px) 100vw, 1024px"');
    });
  });

  describe('MediaGrid.tsx', () => {
    it('sets responsive sizes on marquee items matching basis breakpoints', () => {
      const html = renderToStaticMarkup(<MediaGrid items={mockImages} />);
      expect(html).toContain('sizes="(max-width: 640px) 70vw, (max-width: 768px) 45vw, (max-width: 1024px) 32vw, (max-width: 1280px) 26vw, 300px"');
    });

    it('ensures MediaGrid does not bypass Next.js image optimization with unoptimized', () => {
      const fileContent = readFileSync(
        resolve(process.cwd(), 'app/components/sections/MediaGrid.tsx'),
        'utf8',
      );
      expect(fileContent).not.toContain('unoptimized');
    });

    it('configures lightbox image with responsive sizes capped at 1024px', () => {
      const fileContent = readFileSync(
        resolve(process.cwd(), 'app/components/sections/MediaGrid.tsx'),
        'utf8',
      );
      expect(fileContent).toContain('sizes="(max-width: 1024px) 100vw, 1024px"');
    });
  });

  describe('SponsorMarquee.tsx', () => {
    it('sets explicit sizes="130px" on sponsor logo images', () => {
      const html = renderToStaticMarkup(
        <SponsorMarquee sponsors={[{ id: 'sp-1', name: 'Test Sponsor', logoUrl: '/images/sponsors/test.png' }]} />,
      );
      expect(html).toContain('sizes="130px"');
    });
  });

  describe('GalleryImageCard.tsx (Admin thumbnail)', () => {
    it('removes unoptimized and specifies responsive thumbnail sizes', () => {
      const fileContent = readFileSync(
        resolve(process.cwd(), 'app/components/admin/GalleryImageCard.tsx'),
        'utf8',
      );
      expect(fileContent).not.toContain('unoptimized');
      expect(fileContent).toContain('sizes="(max-width: 640px) 100vw, 200px"');
    });
  });
});
