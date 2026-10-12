import sharp from 'sharp';

/**
 * Longest edge of a gallery thumbnail, in CSS-pixel terms x2. The widest grid
 * card is ~320px wide, so 640px keeps it sharp on 2x screens while staying
 * roughly an order of magnitude smaller than the 2048px original.
 */
export const THUMBNAIL_MAX_EDGE = 640;
export const THUMBNAIL_QUALITY = 80;
export const THUMBNAIL_MIME = 'image/webp';

/**
 * Decoded-pixel ceiling (about 7000x7000). The upload cap limits compressed bytes
 * only, and a few KB of PNG can declare billions of pixels, so sharp is told to
 * refuse to decode anything larger instead of allocating for it.
 */
export const MAX_INPUT_PIXELS = 50_000_000;

/**
 * Formats the decoder may report. Mirrors ALLOWED_MIME_TYPES: the declared MIME
 * is client-controlled, so the decoded format is what actually gets trusted
 * (an SVG or TIFF labelled image/png is rejected here).
 */
export const ALLOWED_DECODED_FORMATS = ['jpeg', 'png', 'webp', 'gif'] as const;

/** Raised for input the uploader should be told about; anything else is an opaque decode failure. */
export class ImageInputError extends Error {
  constructor(
    readonly code: 'unsupported-format' | 'too-large',
    message: string,
  ) {
    super(message);
    this.name = 'ImageInputError';
  }
}

const SHARP_OPTIONS = { limitInputPixels: MAX_INPUT_PIXELS } as const;

function rethrowPixelLimit(err: unknown): never {
  if (err instanceof Error && /pixel limit/i.test(err.message)) {
    throw new ImageInputError('too-large', 'That image has too many pixels. Resize it and try again.');
  }
  throw err;
}

/**
 * Cheap magic-byte sniff for the four allowed formats. Run before sharp so that
 * SVG and every other format never reaches the decoders (sharp parses SVG with
 * librsvg even for a metadata-only call).
 */
export function sniffAllowedFormat(bytes: Uint8Array): (typeof ALLOWED_DECODED_FORMATS)[number] | null {
  const startsWith = (sig: readonly number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (startsWith([0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith([0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return 'gif';
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
  return null;
}

/**
 * Header-only inspection (no full decode). Rejects formats outside the allowlist
 * and images over the pixel limit before any bytes are written to storage.
 */
export async function inspectImage(input: Buffer | ArrayBuffer) {
  const source = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (!sniffAllowedFormat(source)) {
    throw new ImageInputError('unsupported-format', 'Only JPEG, PNG, WebP or GIF images can be uploaded.');
  }
  let meta;
  try {
    // Deliberately not `animated: true`: that reports the summed height of every
    // frame, so a legitimate animated GIF (say 480x480x250) would trip the pixel
    // cap. Without it width/height describe one frame and `pages` still gives the count.
    meta = await sharp(source, SHARP_OPTIONS).metadata();
  } catch (err) {
    rethrowPixelLimit(err);
  }
  if (!meta.format || !(ALLOWED_DECODED_FORMATS as readonly string[]).includes(meta.format)) {
    throw new ImageInputError('unsupported-format', 'Only JPEG, PNG, WebP or GIF images can be uploaded.');
  }
  if ((meta.width ?? 0) * (meta.height ?? 0) > MAX_INPUT_PIXELS) {
    throw new ImageInputError('too-large', 'That image has too many pixels. Resize it and try again.');
  }
  return { source, meta };
}

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
  const { source, meta } = await inspectImage(input);
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
  let encoded;
  try {
    encoded = await sharp(source, SHARP_OPTIONS)
      .rotate()
      .resize({ width: THUMBNAIL_MAX_EDGE, height: THUMBNAIL_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer({ resolveWithObject: true });
  } catch (err) {
    rethrowPixelLimit(err);
  }
  const { data, info } = encoded;

  return { skipped: false, buffer: data, width: info.width, height: info.height, mime: THUMBNAIL_MIME };
}
