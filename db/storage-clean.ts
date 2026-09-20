/**
 * Companion Storage Cleanup Script
 *
 * Purges unreferenced or abandoned storage folders and objects in the `admin-uploads`
 * bucket older than 24 hours.
 *
 * Scans scoped entity folders:
 *   - gallery/<entityId>/<timestamp>.<ext>
 *   - schools/<entityId>/<timestamp>.<ext>
 *   - sponsors/<entityId>/<timestamp>.<ext>
 *   - leadership/<personId>/<timestamp>.<ext>
 *
 * An object is considered unreferenced/abandoned if:
 * 1. Its entity folder is not referenced by an active row in the respective table, OR
 * 2. It is an old replaced image within an active entity folder that is no longer the row's storageKey,
 * AND the file is older than 24 hours.
 *
 * Run manually via: npm run db:storage:clean
 * Dry run mode:     npm run db:storage:clean -- --dry-run
 */
import { db } from '../app/lib/db';
import * as schema from '../app/lib/db/schema';
import { isNull } from 'drizzle-orm';
import { createServiceClient } from '../app/lib/supabase/service';
import { BUCKET, ALLOWED_UPLOAD_SECTIONS, UploadSection } from '../app/lib/storage';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface StorageCleanResult {
  scannedCount: number;
  unreferencedCount: number;
  deletedCount: number;
  deletedKeys: string[];
  errors: string[];
}

export async function cleanAbandonedStorage(options: { dryRun?: boolean } = {}): Promise<StorageCleanResult> {
  const dryRun = Boolean(options.dryRun);
  const now = Date.now();
  const cutoffTime = now - TWENTY_FOUR_HOURS_MS;
  const result: StorageCleanResult = {
    scannedCount: 0,
    unreferencedCount: 0,
    deletedCount: 0,
    deletedKeys: [],
    errors: [],
  };

  console.log(`[db:storage:clean] Starting storage purge (dryRun: ${dryRun})...`);

  // 1. Gather active entity IDs and storage keys from the database
  const activeKeys = new Set<string>();
  const activeEntitiesBySection: Record<UploadSection, Set<string>> = {
    gallery: new Set<string>(),
    schools: new Set<string>(),
    sponsors: new Set<string>(),
    leadership: new Set<string>(),
  };

  try {
    const galleryRows = await db
      .select({ id: schema.galleryImages.id, storageKey: schema.galleryImages.storageKey })
      .from(schema.galleryImages)
      .where(isNull(schema.galleryImages.deletedAt));
    for (const r of galleryRows) {
      if (r.id) activeEntitiesBySection.gallery.add(r.id);
      if (r.storageKey) activeKeys.add(r.storageKey);
    }

    const schoolRows = await db
      .select({ id: schema.schools.id, storageKey: schema.schools.storageKey })
      .from(schema.schools)
      .where(isNull(schema.schools.deletedAt));
    for (const r of schoolRows) {
      if (r.id) activeEntitiesBySection.schools.add(r.id);
      if (r.storageKey) activeKeys.add(r.storageKey);
    }

    const sponsorRows = await db
      .select({ id: schema.sponsors.id, storageKey: schema.sponsors.storageKey })
      .from(schema.sponsors)
      .where(isNull(schema.sponsors.deletedAt));
    for (const r of sponsorRows) {
      if (r.id) activeEntitiesBySection.sponsors.add(r.id);
      if (r.storageKey) activeKeys.add(r.storageKey);
    }

    const peopleRows = await db
      .select({ id: schema.people.id, storageKey: schema.people.storageKey })
      .from(schema.people);
    for (const r of peopleRows) {
      if (r.id) activeEntitiesBySection.leadership.add(r.id);
      if (r.storageKey) activeKeys.add(r.storageKey);
    }
  } catch (err) {
    const msg = `Failed to query database for active records: ${err}`;
    console.error(msg);
    result.errors.push(msg);
    return result;
  }

  const supabase = createServiceClient();
  const keysToDelete: string[] = [];

  // Helper to determine if a storage object is older than 24h
  function isOlderThan24h(fileName: string, createdAt?: string | null): boolean {
    const prefixNum = parseInt(fileName.split('.')[0], 10);
    if (!isNaN(prefixNum) && prefixNum > 0 && prefixNum < now) {
      return prefixNum < cutoffTime;
    }
    if (createdAt) {
      const createdTime = new Date(createdAt).getTime();
      if (!isNaN(createdTime) && createdTime > 0) {
        return createdTime < cutoffTime;
      }
    }
    // If age cannot be determined, do not prematurely delete
    return false;
  }

  // 2. Scan each section
  for (const section of ALLOWED_UPLOAD_SECTIONS) {
    console.log(`[db:storage:clean] Checking section: ${section}...`);
    const { data: items, error } = await supabase.storage.from(BUCKET).list(section, { limit: 1000 });
    if (error) {
      const msg = `Failed to list section folder ${section}: ${error.message}`;
      console.warn(msg);
      result.errors.push(msg);
      continue;
    }

    if (!items || items.length === 0) continue;

    for (const item of items) {
      // Subfolder represents an entityId
      const entityId = item.name;
      const isEntityActive = activeEntitiesBySection[section].has(entityId);

      const folderPath = `${section}/${entityId}`;
      const { data: files, error: filesError } = await supabase.storage.from(BUCKET).list(folderPath, { limit: 1000 });
      if (filesError) {
        result.errors.push(`Failed to list files in ${folderPath}: ${filesError.message}`);
        continue;
      }

      if (!files) continue;

      for (const file of files) {
        if (!file.name) continue;
        result.scannedCount += 1;

        const fullKey = `${folderPath}/${file.name}`;
        const isReferenced = activeKeys.has(fullKey);

        if (!isEntityActive || !isReferenced) {
          result.unreferencedCount += 1;
          if (isOlderThan24h(file.name, file.created_at)) {
            keysToDelete.push(fullKey);
          }
        }
      }
    }
  }

  // 3. Delete unreferenced objects in batches
  console.log(
    `[db:storage:clean] Found ${result.scannedCount} total objects, ${result.unreferencedCount} unreferenced, ${keysToDelete.length} unreferenced & older than 24h.`,
  );

  result.deletedKeys = keysToDelete;

  if (keysToDelete.length > 0 && !dryRun) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
      const batch = keysToDelete.slice(i, i + BATCH_SIZE);
      const { error: deleteError } = await supabase.storage.from(BUCKET).remove(batch);
      if (deleteError) {
        const msg = `Failed to delete batch starting at index ${i}: ${deleteError.message}`;
        console.error(msg);
        result.errors.push(msg);
      } else {
        result.deletedCount += batch.length;
      }
    }
    console.log(`[db:storage:clean] Successfully deleted ${result.deletedCount} abandoned storage object(s).`);
  } else if (dryRun) {
    console.log(`[db:storage:clean] Dry run complete. Would have deleted ${keysToDelete.length} object(s):`);
    for (const k of keysToDelete) console.log(`  - ${k}`);
  }

  return result;
}

// Direct CLI execution
if (process.argv[1]?.endsWith('storage-clean.ts')) {
  const isDryRun = process.argv.includes('--dry-run');
  cleanAbandonedStorage({ dryRun: isDryRun })
    .then((res) => {
      if (res.errors.length > 0) {
        console.warn(`[db:storage:clean] Completed with ${res.errors.length} warning(s)/error(s).`);
      } else {
        console.log(`[db:storage:clean] Finished cleanly.`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('[db:storage:clean] Fatal script error:', err);
      process.exit(1);
    });
}
