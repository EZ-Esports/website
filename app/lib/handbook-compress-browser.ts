/**
 * Browser half of handbook PDF compression: Flate inflation via
 * DecompressionStream and JPEG encoding via canvas, plus the orchestration the
 * uploader calls. Loaded with a dynamic import only when a file is large, so
 * pdf-lib never reaches the admin page's first load.
 */
import { formatBytes } from '@/app/lib/staff-resume';
import { HANDBOOK_MAX_BYTES } from '@/app/lib/handbook';
import {
  COMPRESSION_PASSES,
  recompressPdfImages,
  shouldCompress,
  type EncodeOptions,
  type ImageIo,
} from '@/app/lib/handbook-compress';

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function toJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('JPEG encoding failed'))), 'image/jpeg', quality / 100),
  );
}

export const browserImageIo: ImageIo = {
  async inflate(data) {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  },

  async encodeJpeg(raw, width, height, channels, { quality, maxWidth }: EncodeOptions) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0, p = 0, q = 0; i < width * height; i++) {
      if (channels === 3) {
        rgba[q++] = raw[p++];
        rgba[q++] = raw[p++];
        rgba[q++] = raw[p++];
      } else {
        const g = raw[p++];
        rgba[q++] = g;
        rgba[q++] = g;
        rgba[q++] = g;
      }
      rgba[q++] = 255;
    }
    const source = makeCanvas(width, height);
    source.getContext('2d')!.putImageData(new ImageData(rgba, width, height), 0, 0);

    const outWidth = Math.min(width, maxWidth);
    const outHeight = Math.max(1, Math.round((height * outWidth) / width));
    const target = outWidth === width ? source : makeCanvas(outWidth, outHeight);
    if (target !== source) {
      const ctx = target.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, outWidth, outHeight);
    }
    const blob = await toJpegBlob(target, quality);
    // Release the big pixel buffers promptly; a handbook can hold several 20 MB bitmaps.
    source.width = source.height = 0;
    target.width = target.height = 0;
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width: outWidth, height: outHeight };
  },
};

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export interface PreparedHandbook {
  file: File;
  compressed: boolean;
}

/**
 * Returns a file that fits the server cap. Small PDFs pass through untouched.
 * Big ones are shrunk (a second, harsher pass if needed). Compression failing
 * never blocks an upload that would have fit; otherwise the error says what
 * size it reached.
 */
export async function prepareHandbookFile(
  file: File,
  onStatus: (message: string) => void,
  io: ImageIo = browserImageIo,
): Promise<PreparedHandbook> {
  if (!shouldCompress(file.size)) return { file, compressed: false };

  const original = new Uint8Array(await file.arrayBuffer());
  let best: Uint8Array | null = null;

  for (let pass = 0; pass < COMPRESSION_PASSES.length; pass++) {
    onStatus(
      pass === 0
        ? `Compressing ${formatBytes(file.size)}…`
        : `Still ${formatBytes(best?.length ?? file.size)}, trying smaller images…`,
    );
    await nextTick();
    try {
      const { bytes } = await recompressPdfImages(original, COMPRESSION_PASSES[pass], io, { yieldToUi: nextTick });
      if (!best || bytes.length < best.length) best = bytes;
    } catch (err) {
      console.error('Handbook PDF compression failed', err);
      break;
    }
    if (best.length <= HANDBOOK_MAX_BYTES) break;
  }

  if (best && best.length <= HANDBOOK_MAX_BYTES && best.length < file.size) {
    onStatus(`Compressed to ${formatBytes(best.length)}, uploading…`);
    return { file: new File([best as BlobPart], file.name, { type: 'application/pdf' }), compressed: true };
  }
  if (file.size <= HANDBOOK_MAX_BYTES) return { file, compressed: false };

  throw new Error(
    best
      ? `That PDF is still ${formatBytes(best.length)} after compression (limit ${formatBytes(HANDBOOK_MAX_BYTES)}). Re-export it with smaller or fewer images.`
      : `That PDF could not be compressed and is ${formatBytes(file.size)} (limit ${formatBytes(HANDBOOK_MAX_BYTES)}). Re-export it with smaller images.`,
  );
}
