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
      // Unoptimized <Image> omits `sizes` from the rendered HTML, so assert the source prop.
      const fileContent = readFileSync(
        resolve(process.cwd(), 'app/(marketing)/gallery/GalleryGrid.tsx'),
        'utf8',
      );
      expect(fileContent).toContain('sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 320px"');
    });

    it('renders Supabase-hosted images unoptimized (raw src, no /_next/image transformation)', () => {
      const html = renderToStaticMarkup(<GalleryGrid items={mockImages} />);
      expect(html).toContain('src="/images/gallery/test-1.png"');
      expect(html).not.toContain('/_next/image');
    });

    it('marks both the grid thumbnail and the lightbox image unoptimized', () => {
      const fileContent = readFileSync(
        resolve(process.cwd(), 'app/(marketing)/gallery/GalleryGrid.tsx'),
        'utf8',
      );
      expect(fileContent.match(/^\s*unoptimized\s*$/gm)).toHaveLength(2);
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
      const fileContent = readFileSync(
        resolve(process.cwd(), 'app/components/sections/MediaGrid.tsx'),
        'utf8',
      );
      expect(fileContent).toContain('sizes="(max-width: 640px) 70vw, (max-width: 768px) 45vw, (max-width: 1024px) 32vw, (max-width: 1280px) 26vw, 300px"');
    });

    it('renders Supabase-hosted images unoptimized (raw src, no /_next/image transformation)', () => {
      const html = renderToStaticMarkup(<MediaGrid items={mockImages} />);
      expect(html).toContain('src="/images/gallery/test-1.png"');
      expect(html).not.toContain('/_next/image');
    });

    it('marks both the marquee image and the lightbox image unoptimized', () => {
      const fileContent = readFileSync(
        resolve(process.cwd(), 'app/components/sections/MediaGrid.tsx'),
        'utf8',
      );
      expect(fileContent.match(/^\s*unoptimized\s*$/gm)).toHaveLength(2);
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
      const fileContent = readFileSync(
        resolve(process.cwd(), 'app/(marketing)/sponsors/SponsorMarquee.tsx'),
        'utf8',
      );
      expect(fileContent).toContain('sizes="130px"');
    });

    it('renders sponsor logos unoptimized (raw src, no /_next/image transformation)', () => {
      const html = renderToStaticMarkup(
        <SponsorMarquee sponsors={[{ id: 'sp-1', name: 'Test Sponsor', logoUrl: '/images/sponsors/test.png' }]} />,
      );
      expect(html).toContain('src="/images/sponsors/test.png"');
      expect(html).not.toContain('/_next/image');
    });
  });

  describe('GalleryImageCard.tsx (Admin thumbnail)', () => {
    it('keeps unoptimized and specifies responsive thumbnail sizes', () => {
      const fileContent = readFileSync(
        resolve(process.cwd(), 'app/components/admin/GalleryImageCard.tsx'),
        'utf8',
      );
      expect(fileContent).toMatch(/^\s*unoptimized\s*$/m);
      expect(fileContent).toContain('sizes="(max-width: 640px) 100vw, 200px"');
    });
  });
});
