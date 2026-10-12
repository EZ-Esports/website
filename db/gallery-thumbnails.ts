/**
 * Pure planning logic for the gallery thumbnail backfill
 * (db/backfill-gallery-thumbnails.ts). No I/O lives here so every decision the
 * script makes about production rows is unit-testable offline.
 */
import { deriveThumbnailKey, isKeyScopedToEntity } from '../app/lib/storage-constants';

export const BACKFILL_ALLOW_ENV = 'GALLERY_THUMBNAIL_BACKFILL_ALLOW';

export interface BackfillRow {
  id: string;
  storageKey: string | null;
  thumbnailUrl: string | null;
  thumbnailStorageKey: string | null;
  deletedAt: Date | null;
}

export type SkipReason = 'deleted' | 'already-has-thumbnail' | 'no-storage-key' | 'animated-format';

export interface BackfillPlan {
  todo: { id: string; storageKey: string; thumbnailKey: string }[];
  skipped: { id: string; reason: SkipReason }[];
}

/**
 * Which rows still need a thumbnail. A row is only eligible when its full-size
 * file lives in its own `gallery/<id>/` folder (so the thumbnail can sit beside
 * it and be cleaned up with it); rows pointing at static assets or foreign URLs
 * are left alone and keep rendering the full image. Re-running after a partial
 * run naturally picks up only what is left.
 */
export function planBackfill(rows: readonly BackfillRow[]): BackfillPlan {
  const plan: BackfillPlan = { todo: [], skipped: [] };
  for (const row of rows) {
    if (row.deletedAt) {
      plan.skipped.push({ id: row.id, reason: 'deleted' });
    } else if (row.thumbnailUrl && row.thumbnailStorageKey) {
      plan.skipped.push({ id: row.id, reason: 'already-has-thumbnail' });
    } else if (!row.storageKey || !isKeyScopedToEntity(row.storageKey, 'gallery', row.id)) {
      plan.skipped.push({ id: row.id, reason: 'no-storage-key' });
    } else if (/\.gif$/i.test(row.storageKey)) {
      // Cheap pre-check so animated files are not downloaded just to be skipped.
      plan.skipped.push({ id: row.id, reason: 'animated-format' });
    } else {
      plan.todo.push({ id: row.id, storageKey: row.storageKey, thumbnailKey: deriveThumbnailKey(row.storageKey) });
    }
  }
  return plan;
}

/** Hostname of the Supabase project whose Storage this run would write to. */
export function storageHost(supabaseUrl: string | undefined): string | undefined {
  if (!supabaseUrl) return undefined;
  try {
    return new URL(supabaseUrl).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Accident brake, not permission: modelled on assertSeedTargetAllowed()
 * (db/seed-target.ts). The script writes to a live Storage bucket, so it refuses
 * unless the exact storage host is named in GALLERY_THUMBNAIL_BACKFILL_ALLOW. A
 * blanket value such as `1` is rejected so the opt-in cannot outlive the project
 * it was given for. Passing this check does not mean the run has been approved;
 * ask the owner before using `--apply`.
 */
export function assertBackfillTargetAllowed(
  supabaseUrl: string | undefined,
  env: Record<string, string | undefined> = process.env,
): string {
  const host = storageHost(supabaseUrl);
  if (!host) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing or unparseable; refusing to run.');
  }
  const allowed = env[BACKFILL_ALLOW_ENV]?.trim().toLowerCase();
  if (allowed !== host) {
    throw new Error(
      `Storage host is ${host}. Set ${BACKFILL_ALLOW_ENV}=${host} to run against it ` +
        `(currently ${allowed ? JSON.stringify(allowed) : 'unset'}). The value must be the exact host.`,
    );
  }
  return host;
}

export interface BackfillArgs {
  apply: boolean;
  bucket: string;
  limit: number | null;
  previewDir: string | null;
}

/** Parses `--apply`, `--bucket=<name>`, `--limit=<n>`, `--preview-dir=<path>`. Dry run unless `--apply`. */
export function parseBackfillArgs(argv: readonly string[], expectedBucket: string): BackfillArgs {
  const value = (name: string) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
  };

  const bucket = value('bucket');
  if (!bucket) throw new Error(`--bucket=<name> is required (expected ${expectedBucket}).`);
  if (bucket !== expectedBucket) {
    throw new Error(`--bucket=${bucket} does not match the gallery bucket ${expectedBucket}.`);
  }

  const rawLimit = value('limit');
  let limit: number | null = null;
  if (rawLimit !== null) {
    limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit <= 0) throw new Error('--limit must be a positive integer.');
  }

  return { apply: argv.includes('--apply'), bucket, limit, previewDir: value('preview-dir') };
}
