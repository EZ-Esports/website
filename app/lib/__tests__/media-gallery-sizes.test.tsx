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
import nextConfig from '@/next.config';
import type { Image as ImageType } from '@/app/types';

const SUPABASE = 'https://fziqdmlymqtobxrngneh.supabase.co/storage/v1/object/public/admin-uploads';
const FULL = `${SUPABASE}/gallery/a/1700000000000.webp`;
const THUMB = `${SUPABASE}/gallery/a/1700000000000_thumb.webp`;

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Gallery image tiers: thumbnails unoptimized, lightbox optimized', () => {
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
    it('serves the FULL image through /_next/image, never the thumbnail', () => {
      const html = renderToStaticMarkup(<GalleryLightboxImage item={{ src: FULL, alt: 'Big' }} />);
      expect(html).toContain('/_next/image?url=');
      expect(html).toContain(encodeURIComponent(FULL));
      expect(html).not.toContain(encodeURIComponent(THUMB));
    });

    it('declares a bounded sizes hint for the large view', () => {
      const html = renderToStaticMarkup(<GalleryLightboxImage item={{ src: FULL, alt: 'Big' }} />);
      expect(html).toContain('sizes="(max-width: 1024px) 100vw, 1024px"');
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
    it('keeps unoptimized on the thumbnail only: the lightbox <Image> must stay optimizable', () => {
      const source = read('app/components/ui/GalleryImage.tsx');
      const lightbox = source.slice(source.indexOf('export function GalleryLightboxImage'));
      expect(source.match(/^\s*unoptimized\s*$/gm)).toHaveLength(1);
      expect(lightbox).not.toMatch(/^\s*unoptimized\s*$/m);
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

  describe('next.config.ts images', () => {
    it('limits transformation variants for the lightbox and caches them long', () => {
      const images = nextConfig.images!;
      expect(images.deviceSizes).toHaveLength(3);
      expect(images.qualities).toEqual([75]);
      expect(images.formats).toEqual(['image/webp']);
      expect(images.minimumCacheTTL).toBeGreaterThanOrEqual(31 * 24 * 60 * 60);
    });
  });
});
