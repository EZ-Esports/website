import Image from 'next/image';
import type { Image as ImageType } from '@/app/types';

/**
 * Gallery photos are served in two tiers so Vercel image transformations
 * (a metered monthly quota) are only spent when a visitor opens a photo:
 *
 *  - Thumbnails (marquee, grid cards, admin cards) load straight from Supabase
 *    with `unoptimized`. The object is already a small, 1-year-cacheable WebP, so
 *    `/_next/image` would only add a billable transformation.
 *  - The lightbox renders the full-size file WITHOUT `unoptimized`, so Next resizes
 *    it through `/_next/image` for the visitor's viewport.
 */

type PhotoSource = Pick<ImageType, 'src' | 'thumbnailSrc'>;

/**
 * The single place that decides what a grid/marquee tile loads. Photos that have
 * no thumbnail yet (rows uploaded before thumbnails existed and not backfilled,
 * animated GIFs) fall back to the full-size file, which is still rendered
 * unoptimized by the callers, so nothing breaks and nothing is billed.
 */
export function getThumbnailSrc(item: PhotoSource): string {
  return item.thumbnailSrc || item.src;
}

interface GalleryThumbnailProps {
  item: PhotoSource & { alt: string };
  sizes: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}

/** Fill-mode tile image; the parent supplies the sized, `relative` box. */
export function GalleryThumbnail({ item, sizes, className, loading }: GalleryThumbnailProps) {
  return (
    <Image
      src={getThumbnailSrc(item)}
      alt={item.alt}
      fill
      loading={loading}
      sizes={sizes}
      unoptimized
      className={className}
    />
  );
}

interface GalleryLightboxImageProps {
  item: { src: string; alt: string };
  className?: string;
}

/** Large preview. Deliberately omits `unoptimized`: this is the only gallery image allowed to hit /_next/image. */
export function GalleryLightboxImage({ item, className }: GalleryLightboxImageProps) {
  return (
    <Image
      src={item.src}
      alt={item.alt}
      width={1200}
      height={800}
      priority
      sizes="(max-width: 1024px) 100vw, 1024px"
      className={className}
    />
  );
}
