import sharp from 'sharp';

/**
 * Longest edge of a gallery thumbnail, in CSS-pixel terms x2. The widest grid
 * card is ~320px wide, so 640px keeps it sharp on 2x screens while staying
 * roughly an order of magnitude smaller than the 2048px original.
 */
export const THUMBNAIL_MAX_EDGE = 640;
export const THUMBNAIL_QUALITY = 80;
export const THUMBNAIL_MIME = 'image/webp';

export type ThumbnailPlan =
  | { skip: true; reason: 'animated' | 'unreadable' }
  | { skip: false; width: number; height: number };

/**
 * Pure sizing/skip decision, kept separate from the encoder so it is cheap to test.
 * Animated sources (GIF, animated WebP) are skipped: a still frame would misrepresent
 * the photo, so those rows fall back to the full file. Never upscales.
 */
export function planThumbnail(meta: {
  width?: number;
  height?: number;
  pages?: number;
  format?: string;
}): ThumbnailPlan {
  const { width, height, pages, format } = meta;
  if (!width || !height || width <= 0 || height <= 0) return { skip: true, reason: 'unreadable' };
  if (format === 'gif' || (pages ?? 1) > 1) return { skip: true, reason: 'animated' };

  const ratio = Math.min(1, THUMBNAIL_MAX_EDGE / Math.max(width, height));
  return {
    skip: false,
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

export type ThumbnailResult =
  | { skipped: true; reason: 'animated' }
  | { skipped: false; buffer: Buffer; width: number; height: number; mime: typeof THUMBNAIL_MIME };

/**
 * Encodes a WebP thumbnail. Shared by the upload route and the backfill script so
 * both produce identical output. Throws if the bytes are not a decodable image,
 * which doubles as a content check on the client-declared MIME type.
 */
export async function generateThumbnail(input: Buffer | ArrayBuffer): Promise<ThumbnailResult> {
  const source = Buffer.isBuffer(input) ? input : Buffer.from(input);
  // `animated: true` makes sharp report every frame in `pages`.
  const meta = await sharp(source, { animated: true }).metadata();
  const plan = planThumbnail({
    width: meta.width,
    // For animated images sharp reports the full multi-frame height; pageHeight is one frame.
    height: meta.pageHeight ?? meta.height,
    pages: meta.pages,
    format: meta.format,
  });
  if (plan.skip) {
    if (plan.reason === 'unreadable') throw new Error('Image has no readable dimensions');
    return { skipped: true, reason: plan.reason };
  }

  // rotate() applies EXIF orientation so phone photos are not stored sideways once
  // the metadata is stripped; the bounding box is square so it holds for either axis.
  const { data, info } = await sharp(source)
    .rotate()
    .resize({ width: THUMBNAIL_MAX_EDGE, height: THUMBNAIL_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return { skipped: false, buffer: data, width: info.width, height: info.height, mime: THUMBNAIL_MIME };
}
