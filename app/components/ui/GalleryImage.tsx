import Image from 'next/image';
import type { Image as ImageType } from '@/app/types';

/**
 * Every gallery image is `unoptimized`: it loads straight from Supabase and never
 * goes through `/_next/image`, whose transformations are a metered monthly quota.
 *
 *  - Thumbnails (marquee, grid cards, admin cards) are small, 1-year-cacheable WebPs
 *    generated at upload time, so grids never download the full-size file.
 *  - The full-size file is fetched only by the lightbox, and only once a visitor
 *    opens a photo. The lightbox is mounted only while open and renders a single
 *    image, so there is no adjacent-image preloading and nothing is `priority`.
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

/** Large preview of the full-size file, served raw from Supabase like every other gallery image. */
export function GalleryLightboxImage({ item, className }: GalleryLightboxImageProps) {
  return (
    <Image
      src={item.src}
      alt={item.alt}
      width={1200}
      height={800}
      unoptimized
      className={className}
    />
  );
}
