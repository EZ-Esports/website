import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GalleryGrid from '@/app/(marketing)/gallery/GalleryGrid';
import MediaGrid from '@/app/components/sections/MediaGrid';
import SponsorMarquee from '@/app/(marketing)/sponsors/SponsorMarquee';
import {
  GalleryLightboxImage,
  GalleryThumbnail,
  getThumbnailSrc,
} from '@/app/components/ui/GalleryImage';
import type { Image as ImageType } from '@/app/types';

const SUPABASE = 'https://fziqdmlymqtobxrngneh.supabase.co/storage/v1/object/public/admin-uploads';
const FULL = `${SUPABASE}/gallery/a/1700000000000.webp`;
const THUMB = `${SUPABASE}/gallery/a/1700000000000_thumb.webp`;

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Gallery image tiers: thumbnails in grids, full image only in the lightbox, nothing via /_next/image', () => {
  const withThumb: ImageType[] = [
    { id: '1', src: FULL, thumbnailSrc: THUMB, alt: 'Has thumbnail' },
    { id: '2', src: `${SUPABASE}/gallery/b/1700000000001.jpg`, thumbnailSrc: null, alt: 'No thumbnail yet' },
  ];

  describe('getThumbnailSrc (shared fallback helper)', () => {
    it('prefers the thumbnail when present', () => {
      expect(getThumbnailSrc({ src: FULL, thumbnailSrc: THUMB })).toBe(THUMB);
    });

    it.each([null, undefined, ''])('falls back to the full image when thumbnailSrc is %j', (thumbnailSrc) => {
      expect(getThumbnailSrc({ src: FULL, thumbnailSrc })).toBe(FULL);
    });
  });

  describe('GalleryThumbnail', () => {
    it('renders the thumbnail directly from Supabase with no /_next/image hop', () => {
      const html = renderToStaticMarkup(
        <GalleryThumbnail item={withThumb[0]} sizes="320px" />,
      );
      expect(html).toContain(`src="${THUMB}"`);
      expect(html).not.toContain('/_next/image');
      expect(html).not.toContain('srcSet');
      expect(html).not.toContain('srcset');
    });

    it('renders the full image unoptimized (still no transformation) when no thumbnail exists', () => {
      const html = renderToStaticMarkup(<GalleryThumbnail item={withThumb[1]} sizes="320px" />);
      expect(html).toContain(`src="${withThumb[1].src}"`);
      expect(html).not.toContain('/_next/image');
    });
  });

  describe('GalleryLightboxImage', () => {
    it('renders the FULL image straight from Supabase: no /_next/image, never the thumbnail', () => {
      const html = renderToStaticMarkup(<GalleryLightboxImage item={{ src: FULL, alt: 'Big' }} />);
      expect(html).toContain(`src="${FULL}"`);
      expect(html).not.toContain('/_next/image');
      expect(html).not.toContain(THUMB);
    });

    it('keeps explicit dimensions (no layout shift) and is not preloaded', () => {
      const html = renderToStaticMarkup(<GalleryLightboxImage item={{ src: FULL, alt: 'Big' }} />);
      expect(html).toContain('width="1200"');
      expect(html).toContain('height="800"');
      expect(html).not.toContain('fetchPriority');
      expect(html).not.toContain('fetchpriority');
    });
  });

  describe('GalleryGrid.tsx', () => {
    it('grid cards point at thumbnails (or the full file as fallback) and never call /_next/image', () => {
      const html = renderToStaticMarkup(<GalleryGrid items={withThumb} />);
      expect(html).toContain(`src="${THUMB}"`);
      expect(html).toContain(`src="${withThumb[1].src}"`);
      expect(html).not.toContain(encodeURIComponent(FULL));
      expect(html).not.toContain('/_next/image');
    });

    it('sets responsive sizes on photo cards to mitigate mobile bandwidth egress', () => {
      expect(read('app/(marketing)/gallery/GalleryGrid.tsx')).toContain(
        'sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 320px"',
      );
    });

    it('delegates image rendering to the shared tier components, with no raw unoptimized <Image>', () => {
      const source = read('app/(marketing)/gallery/GalleryGrid.tsx');
      expect(source).toContain('<GalleryThumbnail');
      expect(source).toContain('<GalleryLightboxImage');
      expect(source).not.toMatch(/<Image\b/);
      expect(source).not.toContain('unoptimized');
    });
  });

  describe('MediaGrid.tsx (homepage marquee)', () => {
    it('marquee tiles point at thumbnails and never call /_next/image', () => {
      const html = renderToStaticMarkup(<MediaGrid items={withThumb} />);
      expect(html).toContain(`src="${THUMB}"`);
      expect(html).toContain(`src="${withThumb[1].src}"`);
      expect(html).not.toContain(encodeURIComponent(FULL));
      expect(html).not.toContain('/_next/image');
    });

    it('sets responsive sizes on marquee items matching basis breakpoints', () => {
      expect(read('app/components/sections/MediaGrid.tsx')).toContain(
        'sizes="(max-width: 640px) 70vw, (max-width: 768px) 45vw, (max-width: 1024px) 32vw, (max-width: 1280px) 26vw, 300px"',
      );
    });

    it('delegates image rendering to the shared tier components, with no raw unoptimized <Image>', () => {
      const source = read('app/components/sections/MediaGrid.tsx');
      expect(source).toContain('<GalleryThumbnail');
      expect(source).toContain('<GalleryLightboxImage');
      expect(source).not.toMatch(/<Image\b/);
      expect(source).not.toContain('unoptimized');
    });
  });

  describe('GalleryImage.tsx', () => {
    it('marks both tiers unoptimized and never sets priority', () => {
      const source = read('app/components/ui/GalleryImage.tsx');
      expect(source.match(/<Image\b/g)).toHaveLength(2);
      expect(source.match(/^\s*unoptimized\s*$/gm)).toHaveLength(2);
      expect(source).not.toMatch(/^\s*priority\s*$/m);
    });
  });

  describe('no gallery <Image> can reach /_next/image', () => {
    const GALLERY_FILES = [
      'app/components/ui/GalleryImage.tsx',
      'app/components/admin/GalleryImageCard.tsx',
      'app/components/sections/MediaGrid.tsx',
      'app/(marketing)/gallery/GalleryGrid.tsx',
    ];

    it.each(GALLERY_FILES)('%s: every <Image> element declares unoptimized', (file) => {
      const elements = read(file).match(/<Image\b[^>]*?\/>/gs) ?? [];
      for (const element of elements) expect(element).toMatch(/\bunoptimized\b/);
    });

    it('the lightboxes mount an image only while a photo is selected', () => {
      for (const file of ['app/components/sections/MediaGrid.tsx', 'app/(marketing)/gallery/GalleryGrid.tsx']) {
        const source = read(file);
        expect(source.match(/<GalleryLightboxImage/g)).toHaveLength(1);
        expect(source).toMatch(/selectedImageIndex !== null && \(/);
      }
    });
  });

  describe('SponsorMarquee.tsx', () => {
    it('sets explicit sizes="130px" on sponsor logo images', () => {
      expect(read('app/(marketing)/sponsors/SponsorMarquee.tsx')).toContain('sizes="130px"');
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
    it('uses the shared thumbnail helper, stays unoptimized and keeps responsive sizes', () => {
      const source = read('app/components/admin/GalleryImageCard.tsx');
      expect(source).toContain('getThumbnailSrc(');
      expect(source).toMatch(/^\s*unoptimized\s*$/m);
      expect(source).toContain('sizes="(max-width: 640px) 100vw, 200px"');
    });
  });
});
