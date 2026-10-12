import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { deflateSync } from 'node:zlib';
import {
  ImageInputError,
  MAX_INPUT_PIXELS,
  THUMBNAIL_MAX_EDGE,
  inspectImage,
  generateThumbnail,
  planThumbnail,
} from '@/app/lib/image-thumbnail';

// Noise defeats compression, so the "10x smaller" claim is tested against a
// photo-like worst case rather than a flat colour that would shrink to nothing.
async function photoLike(width: number, height: number, format: 'jpeg' | 'png' | 'webp' = 'jpeg') {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      // Smooth gradients plus mild noise approximate a real photograph.
      raw[i] = (x * 255) / width + ((x * 7 + y * 13) % 17);
      raw[i + 1] = (y * 255) / height + ((x * 11 + y * 5) % 13);
      raw[i + 2] = ((x + y) * 255) / (width + height) + ((x * 3 + y * 17) % 19);
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })[format]().toBuffer();
}

describe('planThumbnail', () => {
  it('scales the longest edge down to the thumbnail size, keeping aspect ratio', () => {
    expect(planThumbnail({ width: 2048, height: 1024, format: 'jpeg' })).toEqual({
      skip: false,
      width: THUMBNAIL_MAX_EDGE,
      height: 320,
    });
    expect(planThumbnail({ width: 1000, height: 2000, format: 'png' })).toEqual({
      skip: false,
      width: 320,
      height: THUMBNAIL_MAX_EDGE,
    });
  });

  it('never upscales small images', () => {
    expect(planThumbnail({ width: 300, height: 200, format: 'png' })).toEqual({ skip: false, width: 300, height: 200 });
  });

  it('skips GIFs and multi-frame images', () => {
    expect(planThumbnail({ width: 800, height: 600, format: 'gif' })).toEqual({ skip: true, reason: 'animated' });
    expect(planThumbnail({ width: 800, height: 600, format: 'webp', pages: 12 })).toEqual({ skip: true, reason: 'animated' });
  });

  it('skips images with no readable dimensions', () => {
    expect(planThumbnail({})).toEqual({ skip: true, reason: 'unreadable' });
    expect(planThumbnail({ width: 0, height: 10 })).toEqual({ skip: true, reason: 'unreadable' });
  });
});

describe('generateThumbnail (real sharp)', () => {
  it('produces a WebP no larger than 640px on the long edge, roughly 10x smaller than the source', async () => {
    const source = await photoLike(2048, 1365, 'jpeg');
    const result = await generateThumbnail(source);
    if (result.skipped) throw new Error('should not skip a still JPEG');

    expect(result.mime).toBe('image/webp');
    expect(result.width).toBe(640);
    expect(result.height).toBeGreaterThanOrEqual(426);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(THUMBNAIL_MAX_EDGE);
    expect(source.length / result.buffer.length).toBeGreaterThan(5);
  });

  it('handles portrait PNG input and accepts an ArrayBuffer', async () => {
    const source = await photoLike(900, 1800, 'png');
    const ab = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength) as ArrayBuffer;
    const result = await generateThumbnail(ab);
    if (result.skipped) throw new Error('should not skip a still PNG');
    expect(result.height).toBe(640);
    expect(result.width).toBe(320);
  });

  it('does not enlarge an image already smaller than the thumbnail size', async () => {
    const result = await generateThumbnail(await photoLike(200, 100, 'webp'));
    if (result.skipped) throw new Error('should not skip');
    expect([result.width, result.height]).toEqual([200, 100]);
  });

  it('applies EXIF orientation so rotated phone photos are not stored sideways', async () => {
    const landscape = await sharp(await photoLike(800, 400, 'jpeg')).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const result = await generateThumbnail(landscape);
    if (result.skipped) throw new Error('should not skip');
    // Orientation 6 means the stored 800x400 pixels display as 400x800.
    expect(result.width).toBe(320);
    expect(result.height).toBe(640);
  });

  it('skips GIFs instead of producing a misleading still frame', async () => {
    const gif = await sharp(await photoLike(64, 64, 'png')).gif().toBuffer();
    expect(await generateThumbnail(gif)).toEqual({ skipped: true, reason: 'animated' });
  });

  it('skips animated WebP', async () => {
    // Frames must differ or the WebP encoder collapses them into a still image.
    const solid = (background: string) =>
      sharp({ create: { width: 64, height: 64, channels: 3, background } }).png().toBuffer();
    const animated = await sharp([await solid('#ff0000'), await solid('#00ff00')], { join: { animated: true } })
      .webp({ loop: 0, delay: [100, 100] })
      .toBuffer();
    expect((await sharp(animated, { animated: true }).metadata()).pages).toBe(2);
    expect(await generateThumbnail(animated)).toEqual({ skipped: true, reason: 'animated' });
  });

  it('rejects bytes that are not an image', async () => {
    await expect(generateThumbnail(Buffer.from('definitely not an image'))).rejects.toThrow();
  });
});

function crc32(buf: Buffer) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/** A tiny PNG whose header declares width x height 8-bit grayscale pixels. */
function declaredPng(width: number, height: number) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.alloc(64))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('input hardening', () => {
  it('rejects a tiny PNG that declares more pixels than the limit', async () => {
    const bomb = declaredPng(30_000, 30_000);
    expect(bomb.length).toBeLessThan(1000);
    expect(30_000 * 30_000).toBeGreaterThan(MAX_INPUT_PIXELS);
    await expect(generateThumbnail(bomb)).rejects.toMatchObject({ name: 'ImageInputError', code: 'too-large' });
    await expect(inspectImage(bomb)).rejects.toBeInstanceOf(ImageInputError);
  });

  it('rejects a real image over the pixel limit that sharp can actually decode', async () => {
    const big = await sharp({ create: { width: 7200, height: 7200, channels: 3, background: '#000' } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    await expect(generateThumbnail(big)).rejects.toMatchObject({ code: 'too-large' });
  });

  it('rejects SVG even if it was uploaded under an image MIME type', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
    await expect(inspectImage(svg)).rejects.toMatchObject({ code: 'unsupported-format' });
    await expect(generateThumbnail(svg)).rejects.toMatchObject({ code: 'unsupported-format' });
  });

  it('rejects TIFF, which is outside the allowlist', async () => {
    const tiff = await sharp(await photoLike(32, 32, 'png')).tiff().toBuffer();
    await expect(inspectImage(tiff)).rejects.toMatchObject({ code: 'unsupported-format' });
  });

  it.each(['jpeg', 'png', 'webp', 'gif'] as const)('accepts %s', async (format) => {
    const bytes = await sharp(await photoLike(32, 32, 'png'))[format]().toBuffer();
    const { meta } = await inspectImage(bytes);
    expect(meta.format).toBe(format);
  });
});
