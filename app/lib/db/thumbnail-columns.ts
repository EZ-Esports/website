/**
 * Lets gallery code keep working while migration 0046 (gallery_images.thumbnail_url /
 * thumbnail_storage_key) has not been applied yet, so deploy and migration order
 * can't take the public gallery or the admin page down. Once the columns exist the
 * first attempt always succeeds and the fallback never runs.
 */

const UNDEFINED_COLUMN = '42703';

function errorChain(err: unknown): unknown[] {
  const chain: unknown[] = [];
  let current: unknown = err;
  // Drizzle wraps the driver error in `cause`; bound the walk against cycles.
  for (let i = 0; i < 5 && current; i++) {
    chain.push(current);
    current = (current as { cause?: unknown }).cause;
  }
  return chain;
}

/** True only for Postgres "undefined column" errors that name one of the thumbnail columns. */
export function isMissingThumbnailColumnError(err: unknown): boolean {
  return errorChain(err).some((e) => {
    const { code, message } = e as { code?: unknown; message?: unknown };
    return code === UNDEFINED_COLUMN && typeof message === 'string' && /thumbnail_(url|storage_key)/.test(message);
  });
}

/** Runs `withThumbnails`; if (and only if) the thumbnail columns are missing, runs `legacy` instead. */
export async function withThumbnailColumnFallback<T>(
  withThumbnails: () => Promise<T>,
  legacy: () => Promise<T>,
): Promise<T> {
  try {
    return await withThumbnails();
  } catch (err) {
    if (!isMissingThumbnailColumnError(err)) throw err;
    console.warn('gallery_images thumbnail columns are missing; apply migration 0046. Falling back to full-size images.');
    return legacy();
  }
}
