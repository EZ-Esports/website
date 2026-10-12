/**
 * Pure planning logic for the gallery thumbnail backfill
 * (db/backfill-gallery-thumbnails.ts). No I/O lives here so every decision the
 * script makes about production rows is unit-testable offline.
 */
import { join, resolve, sep } from 'node:path';
import {
  deriveLegacyThumbnailKey,
  deriveThumbnailKey,
  isKeyScopedToEntity,
  sanitizeEntityId,
} from '../app/lib/storage-constants';

export const BACKFILL_ALLOW_ENV = 'GALLERY_THUMBNAIL_BACKFILL_ALLOW';

/** URL prefix, and repo-relative folder, of the static gallery images the backfill may read. */
export const STATIC_GALLERY_URL_PREFIX = '/images/gallery/';
export const STATIC_GALLERY_DIR = ['public', 'images', 'gallery'] as const;

export interface BackfillRow {
  id: string;
  src: string;
  storageKey: string | null;
  thumbnailUrl: string | null;
  thumbnailStorageKey: string | null;
  deletedAt: Date | null;
}

export type SkipReason = 'deleted' | 'already-has-thumbnail' | 'animated-format' | 'unsupported-source';

export type BackfillKind = 'gallery-folder' | 'legacy-root-key' | 'local-static';

export type BackfillTodo = { id: string; src: string; thumbnailKey: string } & (
  | { kind: 'gallery-folder' | 'legacy-root-key'; storageKey: string }
  | { kind: 'local-static'; storageKey: null; fileName: string }
);

export interface BackfillPlan {
  todo: BackfillTodo[];
  skipped: { id: string; reason: SkipReason }[];
}

const STATIC_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(png|jpe?g|webp|gif)$/i;

/**
 * File name of a static gallery asset (`/images/gallery/<name>`), or null if the
 * path is anything else. Strict on purpose: the script reads this file from
 * disk, so the name must be one plain segment with no separators, `..`, encoding
 * (`%`), query or fragment, and a known image extension.
 */
export function parseStaticGalleryPath(src: string | null | undefined): string | null {
  if (typeof src !== 'string' || !src.startsWith(STATIC_GALLERY_URL_PREFIX)) return null;
  const name = src.slice(STATIC_GALLERY_URL_PREFIX.length);
  if (name.includes('..') || !STATIC_FILE_NAME.test(name)) return null;
  return name;
}

/**
 * Absolute path of a static gallery file under `<repoRoot>/public/images/gallery/`.
 * Re-checks containment after resolving, so even a name that slipped past
 * parseStaticGalleryPath could not escape the folder.
 */
export function resolveStaticGalleryFile(repoRoot: string, src: string): string {
  const name = parseStaticGalleryPath(src);
  if (!name) throw new Error(`Not a static gallery path: ${JSON.stringify(src)}`);
  const dir = resolve(repoRoot, ...STATIC_GALLERY_DIR);
  const file = resolve(join(dir, name));
  if (!file.startsWith(dir + sep)) throw new Error(`Static gallery path escapes ${dir}: ${JSON.stringify(src)}`);
  return file;
}

/** A legacy bucket object lives at the bucket root: one plain segment, no scope of its own. */
function isRootLevelKey(key: string): boolean {
  return !/[\\/\0]/.test(key) && !key.includes('..') && key !== '.';
}

/**
 * Which rows still need a thumbnail, and where the original comes from:
 *  - `gallery-folder`: the original is in the row's own `gallery/<id>/` folder; the
 *    thumbnail sits beside it (same as a fresh upload).
 *  - `legacy-root-key`: the original is a root-level bucket object; the thumbnail
 *    goes in the row's own `gallery/<id>/` folder. The original is never moved.
 *  - `local-static`: no storage key and `src` is `/images/gallery/<file>` in this
 *    repo; the file is read from `public/` and only the thumbnail is uploaded.
 * Everything else (foreign URLs, other entities' keys, unknown shapes) is skipped
 * and keeps rendering the full image. Re-running after a partial run naturally
 * picks up only what is left.
 */
export function planBackfill(rows: readonly BackfillRow[]): BackfillPlan {
  const plan: BackfillPlan = { todo: [], skipped: [] };
  const skip = (id: string, reason: SkipReason) => plan.skipped.push({ id, reason });

  for (const row of rows) {
    if (row.deletedAt) {
      skip(row.id, 'deleted');
    } else if (row.thumbnailUrl && row.thumbnailStorageKey) {
      skip(row.id, 'already-has-thumbnail');
    } else if (!sanitizeEntityId(row.id)) {
      skip(row.id, 'unsupported-source');
    } else if (row.storageKey) {
      const key = row.storageKey;
      const scoped = isKeyScopedToEntity(key, 'gallery', row.id);
      if (!scoped && !isRootLevelKey(key)) {
        skip(row.id, 'unsupported-source');
      } else if (/\.gif$/i.test(key)) {
        // Cheap pre-check so animated files are not downloaded just to be skipped.
        skip(row.id, 'animated-format');
      } else if (scoped) {
        plan.todo.push({ kind: 'gallery-folder', id: row.id, src: row.src, storageKey: key, thumbnailKey: deriveThumbnailKey(key) });
      } else {
        plan.todo.push({ kind: 'legacy-root-key', id: row.id, src: row.src, storageKey: key, thumbnailKey: deriveLegacyThumbnailKey(row.id, key) });
      }
    } else {
      const fileName = parseStaticGalleryPath(row.src);
      if (!fileName) skip(row.id, 'unsupported-source');
      else if (/\.gif$/i.test(fileName)) skip(row.id, 'animated-format');
      else {
        plan.todo.push({ kind: 'local-static', id: row.id, src: row.src, storageKey: null, fileName, thumbnailKey: deriveLegacyThumbnailKey(row.id, fileName) });
      }
    }
  }
  return plan;
}

/** One dry-run line: what would be created and from where. */
export function describeTodo(t: BackfillTodo): string {
  const from = t.kind === 'local-static' ? `local file public${STATIC_GALLERY_URL_PREFIX}${t.fileName}` : `bucket object ${t.storageKey}`;
  return `would create ${t.thumbnailKey} from ${from} [${t.kind}] (row ${t.id})`;
}

/** Counts by kind and skip reason, for sanity-checking against a manual DB breakdown. */
export function summarizePlan(plan: BackfillPlan, rowCount: number): string[] {
  const kinds: BackfillKind[] = ['gallery-folder', 'legacy-root-key', 'local-static'];
  const reasons: SkipReason[] = ['deleted', 'already-has-thumbnail', 'animated-format', 'unsupported-source'];
  const lines = [`Summary (${rowCount} rows):`];
  for (const k of kinds) lines.push(`  ${k.padEnd(16)} ${plan.todo.filter((t) => t.kind === k).length}`);
  for (const r of reasons) lines.push(`  skipped ${r.padEnd(22)} ${plan.skipped.filter((x) => x.reason === r).length}`);
  return lines;
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

/**
 * The backfill's UPDATE only matches a row that still has the storage key it was
 * planned with and no thumbnail. Matching nothing is not success: the row changed
 * underneath the run, so it must be reported rather than counted as written.
 */
export function classifyRowUpdate(updatedRows: number): 'written' | 'conflict' {
  return updatedRows > 0 ? 'written' : 'conflict';
}
