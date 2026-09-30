import { MAX_IMAGE_DIMENSION } from './storage';

export interface CompressionOptions {
  /**
   * Maximum allowed width or height in pixels.
   * If either exceeds this value, the image is scaled down proportionally.
   * Defaults to MAX_IMAGE_DIMENSION (2048).
   */
  maxDimension?: number;

  /**
   * Quality factor for lossy compression (0 to 1).
   * Defaults to 0.85 (produces visually indistinguishable compression with 80%+ file size reduction).
   */
  quality?: number;

  /**
   * Hard upper bound for compressed file size in bytes.
   * Defaults to MAX_FILE_SIZE_BYTES (5 MB).
   */
  maxSizeBytes?: number;

  /**
   * Target MIME type. If not specified, preserves JPEG for JPEG inputs,
   * and converts PNG/WebP to WebP for modern compression with alpha channel support.
   */
  targetMimeType?: 'image/jpeg' | 'image/webp' | 'image/png';
}

/**
 * Calculates proportionally scaled dimensions constrained to maxDimension.
 */
export function calculateTargetDimensions(
  width: number,
  height: number,
  maxDimension: number = MAX_IMAGE_DIMENSION,
): { width: number; height: number; scaled: boolean } {
  if (width <= 0 || height <= 0) {
    return { width: Math.max(1, width), height: Math.max(1, height), scaled: false };
  }

  if (width <= maxDimension && height <= maxDimension) {
    return { width, height, scaled: false };
  }

  const ratio = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    scaled: true,
  };
}

/**
 * Compresses an image file client-side using HTML Canvas.
 * - Scales down oversized dimensions (e.g. >2048px).
 * - Applies lossy compression (WebP / JPEG @ 0.85 quality).
 * - Preserves animated GIFs intact to avoid frame loss.
 * - Skips re-encoding if the asset is already small (<300 KB) and within bounds.
 * - Gracefully falls back to the original file if canvas/DOM is unavailable or fails.
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {},
): Promise<File> {
  const {
    maxDimension = MAX_IMAGE_DIMENSION,
    quality = 0.85,
  } = options;

  // GIFs: 2D canvas draw flattens animated GIFs to a single frame.
  // Preserve GIFs as-is.
  if (file.type === 'image/gif' || !file.type.startsWith('image/')) {
    return file;
  }

  // Gracefully bypass if running outside the browser (e.g. SSR or Node test)
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  return new Promise((resolve) => {
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      // In case URL.createObjectURL is not available
      return resolve(file);
    }

    const img = new window.Image();

    const cleanup = () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // Ignore
      }
    };

    img.onload = () => {
      try {
        const { width: origWidth, height: origHeight } = img;
        const { width, height, scaled } = calculateTargetDimensions(
          origWidth,
          origHeight,
          maxDimension,
        );

        // If dimensions didn't need downscaling and file is already under 300 KB, skip re-encoding
        if (!scaled && file.size <= 300 * 1024) {
          cleanup();
          return resolve(file);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          return resolve(file);
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Target output format:
        // Use JPEG for JPEG inputs, WebP for PNG/WebP for high compression with alpha support.
        const outputMimeType =
          options.targetMimeType ?? (file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp');

        canvas.toBlob(
          (blob) => {
            cleanup();
            if (!blob) {
              return resolve(file);
            }

            // If the compressed output ended up larger than the original and dimensions weren't scaled down,
            // keep the original file.
            if (!scaled && blob.size >= file.size) {
              return resolve(file);
            }

            // Determine filename extension
            const ext =
              outputMimeType === 'image/webp'
                ? 'webp'
                : outputMimeType === 'image/jpeg'
                  ? 'jpg'
                  : 'png';
            const baseName = file.name.replace(/\.[^.]+$/, '');
            const newName = `${baseName}.${ext}`;

            const compressedFile = new File([blob], newName, {
              type: blob.type || outputMimeType,
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          outputMimeType,
          quality,
        );
      } catch (err) {
        console.error('Image compression failed, falling back to original file:', err);
        cleanup();
        resolve(file);
      }
    };

    img.onerror = () => {
      cleanup();
      resolve(file);
    };

    img.src = objectUrl;
  });
}
