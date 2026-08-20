/**
 * Backfills the new `details` jsonb column on `school_applications` and
 * `staff_applications` for rows that predate it, by re-parsing their `message`
 * text blob back into structured data.
 *
 * Only touches rows where `details IS NULL`, so it is safe to re-run — rows it
 * successfully parses won't be revisited, and rows whose `message` doesn't
 * match the known template (see parseSchoolApplicationMessage /
 * parseStaffApplicationMessage) are left untouched rather than guessed at.
 *
 * Ordering matters: this must run AFTER migration 0033 (which adds the
 * `details` column) and BEFORE the follow-up migration that extends the
 * append-only trigger to guard `details` — that trigger, once applied, would
 * reject every UPDATE this script makes.
 *
 * Run: npm run db:backfill:application-details   (add --dry-run to see counts only)
 */
import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '../app/lib/db';
import * as schema from '../app/lib/db/schema';
import { requireFreshBackup } from './backup';
import { assertSeedTargetAllowed } from './seed-target';
import { parseSchoolApplicationMessage } from '../app/lib/school-application-form';
import { parseStaffApplicationMessage } from '../app/lib/staff-application-form';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!dryRun) {
    // Loopback runs freely; anything else has to be named in SEED_ALLOW_REMOTE.
    assertSeedTargetAllowed();
    // Takes a fresh dump of exactly these two tables and refuses to proceed
    // without one — this UPDATEs live rows in an otherwise append-only table.
    requireFreshBackup(['school_applications', 'staff_applications']);
  }

  const schoolRows = await db
    .select({ id: schema.schoolApplications.id, message: schema.schoolApplications.message })
    .from(schema.schoolApplications)
    .where(and(isNull(schema.schoolApplications.details), sql`${schema.schoolApplications.message} <> ''`));

  let schoolParsed = 0;
  for (const row of schoolRows) {
    const details = parseSchoolApplicationMessage(row.message ?? '');
    if (!details) continue;
    schoolParsed++;
    if (!dryRun) {
      await db.update(schema.schoolApplications).set({ details }).where(eq(schema.schoolApplications.id, row.id));
    }
  }
  console.log(
    `school_applications: ${schoolParsed}/${schoolRows.length} legacy rows parsed` +
      (dryRun ? ' (dry run — no writes made)' : '')
  );

  const staffRows = await db
    .select({ id: schema.staffApplications.id, message: schema.staffApplications.message })
    .from(schema.staffApplications)
    .where(and(isNull(schema.staffApplications.details), sql`${schema.staffApplications.message} <> ''`));

  let staffParsed = 0;
  for (const row of staffRows) {
    const details = parseStaffApplicationMessage(row.message ?? '');
    if (!details) continue;
    staffParsed++;
    if (!dryRun) {
      await db.update(schema.staffApplications).set({ details }).where(eq(schema.staffApplications.id, row.id));
    }
  }
  console.log(
    `staff_applications: ${staffParsed}/${staffRows.length} legacy rows parsed` +
      (dryRun ? ' (dry run — no writes made)' : '')
  );

  const unparsed = (schoolRows.length - schoolParsed) + (staffRows.length - staffParsed);
  if (unparsed > 0) {
    console.log(`${unparsed} row(s) did not match the known message template and were left with details = null.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
