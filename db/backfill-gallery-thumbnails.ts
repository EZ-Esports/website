/**
 * One-off backfill: create thumbnails for gallery photos uploaded before the
 * thumbnail columns existed.
 *
 * DRY RUN BY DEFAULT. Without `--apply` it only lists what it would do; it never
 * writes to Storage or the database. With `--preview-dir=<dir>` it also downloads
 * originals and writes the generated thumbnails to that local folder (keep it
 * gitignored, e.g. db/thumbnail-previews/) so they can be eyeballed first.
 *
 * Safety:
 *  - needs the exact DB host in SEED_ALLOW_REMOTE (db/seed-target.ts) AND the exact
 *    Storage host in GALLERY_THUMBNAIL_BACKFILL_ALLOW;
 *  - `--bucket=admin-uploads` must be typed out;
 *  - only ever uploads `<name>_thumb.webp` beside the original and sets the two
 *    thumbnail columns; originals are never deleted, overwritten or re-keyed;
 *  - idempotent and resumable: rows that already have a thumbnail are skipped, an
 *    already-uploaded thumbnail object is reused, and the row update only matches
 *    rows still lacking a thumbnail.
 *
 * Run (PowerShell):
 *   $env:SEED_ALLOW_REMOTE = "<db host>"; $env:GALLERY_THUMBNAIL_BACKFILL_ALLOW = "<project>.supabase.co"
 *   npm run db:backfill:gallery-thumbnails -- --bucket=admin-uploads            # dry run
 *   npm run db:backfill:gallery-thumbnails -- --bucket=admin-uploads --apply
 *
 * The Data Cache is not touched by this script. Afterwards save any gallery row in
 * /admin/gallery (unchanged) so its action calls updateTag('gallery-images').
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { and, eq, isNull } from 'drizzle-orm';
import * as schema from '../app/lib/db/schema';
import { BUCKET, STORAGE_CACHE_CONTROL } from '../app/lib/storage-constants';
import { generateThumbnail } from '../app/lib/image-thumbnail';
import { assertSeedTargetAllowed } from './seed-target';
import { assertBackfillTargetAllowed, classifyRowUpdate, parseBackfillArgs, planBackfill } from './gallery-thumbnails';

async function main() {
  const args = parseBackfillArgs(process.argv.slice(2), BUCKET);
  assertSeedTargetAllowed();
  assertBackfillTargetAllowed(process.env.NEXT_PUBLIC_SUPABASE_URL);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  const db = drizzle(sql, { schema });

  try {
    const rows = await db
      .select({
        id: schema.galleryImages.id,
        storageKey: schema.galleryImages.storageKey,
        thumbnailUrl: schema.galleryImages.thumbnailUrl,
        thumbnailStorageKey: schema.galleryImages.thumbnailStorageKey,
        deletedAt: schema.galleryImages.deletedAt,
      })
      .from(schema.galleryImages);

    const plan = planBackfill(rows);
    const todo = args.limit ? plan.todo.slice(0, args.limit) : plan.todo;
    console.log(`[gallery-thumbs] ${args.apply ? 'APPLY' : 'DRY RUN'}: ${rows.length} rows, ${todo.length} to process, ${plan.skipped.length} skipped.`);
    for (const s of plan.skipped) console.log(`  skip ${s.id} (${s.reason})`);

    if (!args.apply && !args.previewDir) {
      for (const t of todo) console.log(`  would create ${t.thumbnailKey}`);
      console.log('[gallery-thumbs] Dry run: nothing written. Re-run with --apply to write.');
      return;
    }
    if (args.previewDir) mkdirSync(args.previewDir, { recursive: true });

    let done = 0;
    let failed = 0;
    let conflicts = 0;
    for (const t of todo) {
      try {
        const { data: blob, error: dlError } = await supabase.storage.from(args.bucket).download(t.storageKey);
        if (dlError || !blob) throw new Error(`download failed: ${dlError?.message ?? 'no data'}`);
        const original = Buffer.from(await blob.arrayBuffer());
        const thumb = await generateThumbnail(original);
        if (thumb.skipped) {
          console.log(`  skip ${t.id} (${thumb.reason})`);
          continue;
        }
        const ratio = (original.length / thumb.buffer.length).toFixed(1);
        console.log(`  ${t.id}: ${original.length} B -> ${thumb.buffer.length} B (${ratio}x smaller, ${thumb.width}x${thumb.height})`);

        if (args.previewDir) writeFileSync(join(args.previewDir, `${t.id}.webp`), thumb.buffer);
        if (!args.apply) continue;

        const { error: upError } = await supabase.storage.from(args.bucket).upload(t.thumbnailKey, thumb.buffer, {
          contentType: thumb.mime,
          cacheControl: STORAGE_CACHE_CONTROL,
          upsert: false,
        });
        // A previous interrupted run may have uploaded it already; reuse that object.
        const alreadyThere = upError && /already exists|duplicate/i.test(upError.message);
        if (upError && !alreadyThere) throw new Error(`upload failed: ${upError.message}`);

        const { data: pub } = supabase.storage.from(args.bucket).getPublicUrl(t.thumbnailKey);
        const updated = await db
          .update(schema.galleryImages)
          .set({ thumbnailUrl: pub.publicUrl, thumbnailStorageKey: t.thumbnailKey })
          .where(
            and(
              eq(schema.galleryImages.id, t.id),
              eq(schema.galleryImages.storageKey, t.storageKey),
              isNull(schema.galleryImages.thumbnailStorageKey),
            ),
          )
          .returning({ id: schema.galleryImages.id });
        // Zero rows means the row changed since it was read (photo replaced, thumbnail
        // set by an admin save, or row removed); the uploaded object is left unreferenced.
        if (classifyRowUpdate(updated.length) === 'conflict') {
          conflicts += 1;
          console.warn(`  CONFLICT ${t.id}: row changed during backfill, not updated (re-run to re-evaluate)`);
          continue;
        }
        done += 1;
      } catch (err) {
        failed += 1;
        console.error(`  FAILED ${t.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    console.log(`[gallery-thumbs] Finished: ${done} written, ${conflicts} skipped (row changed), ${failed} failed. Re-run to retry failures.`);
    if (args.apply && done > 0) {
      console.log('[gallery-thumbs] Now save any gallery row in /admin/gallery (unchanged) to refresh the Data Cache.');
    }
    if (failed > 0) process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('[gallery-thumbs] Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
