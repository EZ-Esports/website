import { describe, it, expect, vi } from 'vitest';
import zlib from 'node:zlib';
import { PDFDocument, PDFName, PDFRawStream, PDFArray, type PDFRef } from 'pdf-lib';
import { recompressPdfImages, shouldCompress, unfilterPngRows, type ImageIo } from '../handbook-compress';
import { prepareHandbookFile } from '../handbook-compress-browser';
import { HANDBOOK_MAX_BYTES, checkHandbookSelection, HANDBOOK_MAX_INPUT_BYTES } from '../handbook';

/** Node stand-in for the browser: real zlib, and a fake "JPEG" of a fixed small size. */
function fakeIo(jpegBytes = 4000): ImageIo & { encodeJpeg: ReturnType<typeof vi.fn> } {
  const encodeJpeg = vi.fn(async (_raw: Uint8Array, width: number, height: number) => ({
    bytes: new Uint8Array(jpegBytes).fill(7),
    width,
    height,
  }));
  return { inflate: async (d) => new Uint8Array(zlib.inflateSync(d)), encodeJpeg };
}

function noise(length: number): Uint8Array {
  const out = new Uint8Array(length);
  let x = 12345;
  for (let i = 0; i < length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out[i] = x >> 16;
  }
  return out;
}

interface ImageSpec {
  w: number;
  h: number;
  channels?: number;
  extra?: Record<string, unknown>;
  predictorRows?: boolean;
}

async function buildPdf(images: ImageSpec[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  const xobjects: Record<string, PDFRef> = {};
  images.forEach((spec, i) => {
    const channels = spec.channels ?? 3;
    const rowBytes = spec.w * channels;
    let raw = noise(rowBytes * spec.h);
    if (spec.predictorRows) {
      // PNG "None" filter rows: a leading 0 byte per row.
      const filtered = new Uint8Array((rowBytes + 1) * spec.h);
      for (let y = 0; y < spec.h; y++) filtered.set(raw.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
      raw = filtered;
    }
    const dict = doc.context.obj({
      Type: 'XObject',
      Subtype: 'Image',
      Width: spec.w,
      Height: spec.h,
      ColorSpace: channels === 3 ? 'DeviceRGB' : 'DeviceGray',
      BitsPerComponent: 8,
      Filter: 'FlateDecode',
      ...(spec.predictorRows ? { DecodeParms: { Predictor: 15, Colors: channels, Columns: spec.w } } : {}),
      ...spec.extra,
    });
    const stream = PDFRawStream.of(dict, zlib.deflateSync(raw, { level: 0 }));
    xobjects[`Im${i}`] = doc.context.register(stream);
  });
  page.node.set(PDFName.of('Resources'), doc.context.obj({ XObject: xobjects }));
  return doc.save();
}

async function imageFilters(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  const out: string[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype'))?.toString() === '/Image') {
      out.push(obj.dict.get(PDFName.of('Filter'))?.toString() ?? '');
    }
  }
  return out;
}

/** Forward PNG filter (the encoder side), so the test round-trips every filter type. */
function filterPngRows(img: Uint8Array, width: number, height: number, bpp: number, types: number[]): Uint8Array {
  const stride = width * bpp;
  const out = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const type = types[y % types.length];
    out[y * (stride + 1)] = type;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? img[y * stride + x - bpp] : 0;
      const b = y > 0 ? img[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? img[(y - 1) * stride + x - bpp] : 0;
      let predicted = 0;
      if (type === 1) predicted = a;
      else if (type === 2) predicted = b;
      else if (type === 3) predicted = (a + b) >> 1;
      else if (type === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * (stride + 1) + 1 + x] = (img[y * stride + x] - predicted) & 255;
    }
  }
  return out;
}

describe('unfilterPngRows', () => {
  it('round-trips None, Sub, Up, Average and Paeth filtered rows (RGB and gray)', () => {
    for (const bpp of [1, 3]) {
      const width = 9;
      const height = 10;
      const img = noise(width * height * bpp);
      const filtered = filterPngRows(img, width, height, bpp, [0, 1, 2, 3, 4]);
      expect(Array.from(unfilterPngRows(filtered, width, height, bpp))).toEqual(Array.from(img));
    }
  });

  it('rejects truncated data and unknown filter types', () => {
    expect(() => unfilterPngRows(new Uint8Array(3), 2, 2, 1)).toThrow();
    expect(() => unfilterPngRows(new Uint8Array([9, 1, 2]), 2, 1, 1)).toThrow();
  });
});

describe('recompressPdfImages', () => {
  it('re-encodes a large raw RGB image: smaller, still a valid PDF with the same page count', async () => {
    const original = await buildPdf([{ w: 300, h: 300 }]);
    const io = fakeIo();
    const { bytes, imagesProcessed } = await recompressPdfImages(original, { quality: 75, maxWidth: 1280 }, io);

    expect(imagesProcessed).toBe(1);
    expect(bytes.length).toBeLessThan(original.length / 10);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    expect(await imageFilters(bytes)).toEqual(['/DCTDecode']);
    // The encoder received the inflated pixels.
    expect(io.encodeJpeg.mock.calls[0][0].length).toBe(300 * 300 * 3);
  });

  it('unfilters PNG-predictor images before encoding and handles gray', async () => {
    const original = await buildPdf([
      { w: 400, h: 300, predictorRows: true },
      { w: 600, h: 300, channels: 1 },
    ]);
    const io = fakeIo();
    const { imagesProcessed } = await recompressPdfImages(original, { quality: 75, maxWidth: 1280 }, io);
    expect(imagesProcessed).toBe(2);
    const sizes = io.encodeJpeg.mock.calls.map((c) => c[0].length).sort((a, b) => a - b);
    expect(sizes).toEqual([600 * 300, 400 * 300 * 3]);
  });

  it('leaves small images, soft-masked images, Decode-remapped images and unknown encodings alone', async () => {
    const original = await buildPdf([
      { w: 20, h: 20 },
      { w: 300, h: 300, extra: { Decode: [1, 0, 1, 0, 1, 0] } },
      { w: 300, h: 300, extra: { BitsPerComponent: 16 } },
      { w: 300, h: 300, extra: { ColorSpace: 'DeviceCMYK' } },
    ]);
    const io = fakeIo();
    const { bytes, imagesProcessed } = await recompressPdfImages(original, { quality: 75, maxWidth: 1280 }, io);
    expect(imagesProcessed).toBe(0);
    expect(io.encodeJpeg).not.toHaveBeenCalled();
    expect(await imageFilters(bytes)).toEqual(['/FlateDecode', '/FlateDecode', '/FlateDecode', '/FlateDecode']);
  });

  it('keeps an image whose re-encoding would not be smaller, and survives an encoder failure', async () => {
    const original = await buildPdf([{ w: 300, h: 300 }]);
    const bigger = fakeIo(10_000_000);
    expect((await recompressPdfImages(original, { quality: 75, maxWidth: 1280 }, bigger)).imagesProcessed).toBe(0);

    const failing: ImageIo = { inflate: async (d) => new Uint8Array(zlib.inflateSync(d)), encodeJpeg: async () => { throw new Error('boom'); } };
    const result = await recompressPdfImages(original, { quality: 75, maxWidth: 1280 }, failing);
    expect(result.imagesProcessed).toBe(0);
    expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(1);
  });

  it('handles ICCBased colour spaces by their component count', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 200]);
    const profile = doc.context.register(PDFRawStream.of(doc.context.obj({ N: 3 }), new Uint8Array(10)));
    const raw = noise(300 * 300 * 3);
    const dict = doc.context.obj({ Type: 'XObject', Subtype: 'Image', Width: 300, Height: 300, BitsPerComponent: 8, Filter: 'FlateDecode' });
    dict.set(PDFName.of('ColorSpace'), PDFArray.withContext(doc.context));
    (dict.get(PDFName.of('ColorSpace')) as PDFArray).push(PDFName.of('ICCBased'));
    (dict.get(PDFName.of('ColorSpace')) as PDFArray).push(profile);
    const img = doc.context.register(PDFRawStream.of(dict, zlib.deflateSync(raw, { level: 0 })));
    page.node.set(PDFName.of('Resources'), doc.context.obj({ XObject: { Im0: img } }));
    const io = fakeIo();
    const { imagesProcessed } = await recompressPdfImages(await doc.save(), { quality: 75, maxWidth: 1280 }, io);
    expect(imagesProcessed).toBe(1);
  });
});

describe('thresholds and preparation', () => {
  it('only compresses files over the server cap', () => {
    expect(shouldCompress(HANDBOOK_MAX_BYTES)).toBe(false);
    expect(shouldCompress(HANDBOOK_MAX_BYTES + 1)).toBe(true);
  });

  it('accepts big picks up to 50 MB and rejects non-PDFs and oversize input', () => {
    expect(checkHandbookSelection({ name: 'h.pdf', size: 20 * 1024 * 1024, type: 'application/pdf' })).toBeNull();
    expect(checkHandbookSelection({ name: 'h.pdf', size: HANDBOOK_MAX_INPUT_BYTES + 1, type: 'application/pdf' })).toMatch(/50 MB/);
    expect(checkHandbookSelection({ name: 'h.png', size: 10, type: 'image/png' })).toMatch(/PDF/);
  });

  it('passes small files through untouched and shrinks a big one, reporting status', async () => {
    const small = new File([new Uint8Array(1000)], 'a.pdf', { type: 'application/pdf' });
    expect((await prepareHandbookFile(small, () => {})).compressed).toBe(false);

    // Several incompressible images push the file over the 4 MB cap.
    const pdf = await buildPdf(Array.from({ length: 3 }, () => ({ w: 700, h: 700 })));
    expect(pdf.length).toBeGreaterThan(HANDBOOK_MAX_BYTES);
    const status: string[] = [];
    const out = await prepareHandbookFile(new File([pdf as BlobPart], 'big.pdf', { type: 'application/pdf' }), (m) => status.push(m), fakeIo());
    expect(out.compressed).toBe(true);
    expect(out.file.size).toBeLessThanOrEqual(HANDBOOK_MAX_BYTES);
    expect(out.file.name).toBe('big.pdf');
    expect(status[0]).toMatch(/^Compressing /);
    expect(status.at(-1)).toMatch(/^Compressed to .*uploading/);
  });

  it('tries a second pass, then errors with the reached size when still over the cap', async () => {
    const pdf = await buildPdf(Array.from({ length: 3 }, () => ({ w: 700, h: 700 })));
    const status: string[] = [];
    // Every "JPEG" is 2 MB, so three images stay over 4 MB in both passes.
    await expect(
      prepareHandbookFile(new File([pdf as BlobPart], 'big.pdf', { type: 'application/pdf' }), (m) => status.push(m), fakeIo(2_000_000)),
    ).rejects.toThrow(/still .* MB after compression/);
    expect(status.some((m) => m.startsWith('Still '))).toBe(true);
  });
});
