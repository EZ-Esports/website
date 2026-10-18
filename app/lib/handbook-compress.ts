/**
 * Shrinks the large raster images inside a PDF so a designed handbook export
 * (tens of MB of raw RGB) fits the 4 MB upload cap. Runs in the browser, before
 * the upload, because the platform's request-body limit rejects big files before
 * any server code could compress them.
 *
 * This module is pure PDF surgery: the environment-specific parts (inflating
 * Flate data, JPEG encoding) are injected as an {@link ImageIo}, so it is unit
 * testable in Node. The browser implementation is in `handbook-compress-browser.ts`.
 *
 * Only images that are certain to be safe to re-encode are touched: Flate
 * compressed, 8-bit, plain RGB or gray (device or ICC), no soft mask, no mask,
 * no Decode remapping, and large. Everything else, including all text, fonts and
 * link annotations, is left byte-for-byte.
 */
import { HANDBOOK_MAX_BYTES } from './handbook';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, type PDFObject } from 'pdf-lib';

/** Images smaller than this are not worth re-encoding. */
export const MIN_IMAGE_BYTES = 100_000;

export interface EncodeOptions {
  quality: number; // 1-100
  maxWidth: number;
}

export interface ImageIo {
  /** zlib-inflate (what PDF's FlateDecode uses). */
  inflate(data: Uint8Array): Promise<Uint8Array>;
  /** Encode 8-bit interleaved raw pixels as a JPEG, scaled down to `maxWidth` if wider. */
  encodeJpeg(
    raw: Uint8Array,
    width: number,
    height: number,
    channels: 1 | 3,
    opts: EncodeOptions,
  ): Promise<{ bytes: Uint8Array; width: number; height: number }>;
}

/** Progressively smaller settings; the second pass is only tried if the first is still over the cap. */
export const COMPRESSION_PASSES: readonly EncodeOptions[] = [
  { quality: 75, maxWidth: 1280 },
  { quality: 55, maxWidth: 1000 },
];

/** Only files over the server cap are touched; a PDF that already fits uploads byte-for-byte as exported. */
export function shouldCompress(size: number): boolean {
  return size > HANDBOOK_MAX_BYTES;
}

/**
 * Reverses PNG row filtering (PDF Predictor 10-15). `data` is `height` rows of
 * one filter-type byte followed by `width * bytesPerPixel` filtered bytes.
 */
export function unfilterPngRows(data: Uint8Array, width: number, height: number, bytesPerPixel: number): Uint8Array {
  const stride = width * bytesPerPixel;
  if (data.length < (stride + 1) * height) throw new Error('Filtered image data is too short');
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = data[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    const outRow = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bytesPerPixel ? out[outRow + x - bytesPerPixel] : 0;
      const b = y > 0 ? out[outRow - stride + x] : 0;
      const c = x >= bytesPerPixel && y > 0 ? out[outRow - stride + x - bytesPerPixel] : 0;
      let v = data[rowStart + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) {
        throw new Error('Unknown PNG filter');
      }
      out[outRow + x] = v & 255;
    }
  }
  return out;
}

type Lookup = (obj: PDFObject | undefined) => PDFObject | undefined;

function numberOf(obj: PDFObject | undefined): number | null {
  return obj instanceof PDFNumber ? obj.asNumber() : null;
}

/** 3 for RGB, 1 for gray, null for anything else (CMYK, Indexed, Lab, ...). */
function channelsOf(colorSpace: PDFObject | undefined, lookup: Lookup): 1 | 3 | null {
  const cs = lookup(colorSpace);
  if (cs instanceof PDFName) {
    if (cs.toString() === '/DeviceRGB') return 3;
    if (cs.toString() === '/DeviceGray') return 1;
    return null;
  }
  if (cs instanceof PDFArray && lookup(cs.get(0))?.toString() === '/ICCBased') {
    const profile = lookup(cs.get(1));
    if (profile instanceof PDFRawStream) {
      const n = numberOf(lookup(profile.dict.get(PDFName.of('N'))));
      return n === 3 ? 3 : n === 1 ? 1 : null;
    }
  }
  return null;
}

export interface RecompressResult {
  bytes: Uint8Array;
  imagesProcessed: number;
}

/** Re-encodes eligible images as JPEG and saves a new PDF. Never mutates `pdfBytes`. */
export async function recompressPdfImages(
  pdfBytes: Uint8Array,
  opts: EncodeOptions,
  io: ImageIo,
  hooks: { minImageBytes?: number; yieldToUi?: () => Promise<void> } = {},
): Promise<RecompressResult> {
  const minBytes = hooks.minImageBytes ?? MIN_IMAGE_BYTES;
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const lookup: Lookup = (obj) => (obj ? doc.context.lookup(obj) : undefined);
  let imagesProcessed = 0;

  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    if (dict.get(PDFName.of('Subtype'))?.toString() !== '/Image') continue;
    if (dict.get(PDFName.of('Filter'))?.toString() !== '/FlateDecode') continue;
    if (dict.has(PDFName.of('SMask')) || dict.has(PDFName.of('Mask')) || dict.has(PDFName.of('Decode'))) continue;
    if (lookup(dict.get(PDFName.of('ImageMask')))?.toString() === 'true') continue;
    if (obj.contents.length < minBytes) continue;
    if (numberOf(lookup(dict.get(PDFName.of('BitsPerComponent')))) !== 8) continue;
    const width = numberOf(lookup(dict.get(PDFName.of('Width'))));
    const height = numberOf(lookup(dict.get(PDFName.of('Height'))));
    const channels = channelsOf(dict.get(PDFName.of('ColorSpace')), lookup);
    if (!width || !height || !channels) continue;

    const parms = lookup(dict.get(PDFName.of('DecodeParms')));
    const predictor = parms instanceof PDFDict ? (numberOf(lookup(parms.get(PDFName.of('Predictor')))) ?? 1) : 1;
    if (predictor !== 1 && predictor < 10) continue; // TIFF predictor 2 is not handled

    try {
      await hooks.yieldToUi?.();
      let raw = await io.inflate(obj.contents);
      if (predictor >= 10) raw = unfilterPngRows(raw, width, height, channels);
      if (raw.length !== width * height * channels) continue;
      const jpeg = await io.encodeJpeg(raw, width, height, channels, opts);
      if (jpeg.bytes.length >= obj.contents.length) continue; // never make a file bigger

      const newDict = doc.context.obj({
        Type: 'XObject',
        Subtype: 'Image',
        Width: jpeg.width,
        Height: jpeg.height,
        ColorSpace: 'DeviceRGB',
        BitsPerComponent: 8,
        Filter: 'DCTDecode',
        Length: jpeg.bytes.length,
      });
      doc.context.assign(ref, PDFRawStream.of(newDict, jpeg.bytes));
      imagesProcessed++;
    } catch {
      // One undecodable image must not sink the whole file; it stays as it was.
      continue;
    }
  }

  return { bytes: await doc.save({ useObjectStreams: true }), imagesProcessed };
}
