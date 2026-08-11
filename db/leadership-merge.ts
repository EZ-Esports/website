/**
 * Merging leadership records into the table instead of replacing it.
 *
 * `db/seed.ts` used to wipe `leadership` and re-insert it from
 * staff_completeroster.csv. That made the CSV the owner of a table it is only
 * one contributor to: rows are also authored and edited in the admin leadership
 * editor, and only the database ever held the bios and member links. When the
 * gold seed cascade-deleted 70 of those rows there was no CSV to restore them
 * from and no backup, and they are still gone.
 *
 * So this merges. `(name, role, year)` is the identity — it is unique across
 * every row in production today, and it is exactly the tuple the CSV can
 * reconstruct. Everything the CSV cannot speak to is left alone:
 *
 *   - `member_id` is never written. The CSV has no member column; the links
 *     were made in the admin editor and are the seed's to preserve, not to set.
 *   - a bio that is already there is never overwritten, only filled in when
 *     blank. The CSV's `fun_fact` is a 2021-2025 snapshot; an admin edit is
 *     newer by definition, and a re-run must not undo it.
 *   - soft-deleted rows are matched but never resurrected. Somebody removed
 *     them on purpose, and re-importing the CSV is not a decision to undo that.
 *
 * The same function backs the standalone recovery importer, so a recovered CSV
 * can be merged into the surviving rows without going near the rest of the seed.
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../app/lib/db';
import * as schema from '../app/lib/db/schema';

export type LeadershipRecord = {
  name: string;
  handle?: string | null;
  role: string;
  year: string;
  bio: string | null;
  highSchool?: string | null;
  university?: string | null;
};

export type MergeResult = {
  inserted: number;
  /** Rows that gained a bio, handle, or school info they did not have. Rows already complete are untouched. */
  updated: number;
  /** Matched a soft-deleted row, or more than one row — see `notes`. */
  skipped: number;
  notes: string[];
};

/** The identity tuple, normalised so whitespace and casing cannot fork a row. */
export function leadershipKey(r: { name: string; year: string }): string {
  return [r.name, r.year].map((v) => v.trim().toLowerCase()).join('|');
}

/**
 * Collapses records that share an identity, keeping the first and preferring any
 * bio among them.
 *
 * The CSV is an export of a spreadsheet people maintained by hand, so the same
 * person can appear twice for one year. Left alone that would insert a
 * row on the first pass and match ambiguously on every pass after, so the merge
 * would never settle.
 */
export function dedupeRecords(records: LeadershipRecord[]): {
  unique: LeadershipRecord[];
  collapsed: string[];
} {
  const byKey = new Map<string, LeadershipRecord>();
  const collapsed: string[] = [];

  for (const r of records) {
    const key = leadershipKey(r);
    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, { ...r });
      continue;
    }
    collapsed.push(`${r.name} (${r.year})`);
    if (!seen.bio && r.bio) seen.bio = r.bio;
    if (!seen.handle && r.handle) seen.handle = r.handle;
    if (!seen.highSchool && r.highSchool) seen.highSchool = r.highSchool;
    if (!seen.university && r.university) seen.university = r.university;
  }

  return { unique: [...byKey.values()], collapsed };
}

/**
 * Decides what a single record should do against the rows already present.
 *
 * Split out from the database work so the rules above are unit-testable without
 * a live table — they are the part that is easy to get subtly wrong.
 */
export function planRecord(
  record: LeadershipRecord,
  existing: { id: string; role?: string; bio: string | null; handle?: string | null; highSchool?: string | null; university?: string | null; deletedAt: Date | null }[]
): { action: 'insert' } | { action: 'fill-bio'; id: string; fillBio?: string | null; fillHandle?: string | null; fillHighSchool?: string | null; fillUniversity?: string | null } | { action: 'skip'; note: string } {
  if (existing.length === 0) return { action: 'insert' };

  const active = existing.filter((r) => r.deletedAt === null);

  if (active.length === 0) {
    return {
      action: 'skip',
      note: `${record.name} (${record.year}) is soft-deleted; not resurrecting it`,
    };
  }

  const row = active.find((r) => r.role && r.role.trim().toLowerCase() === record.role.trim().toLowerCase()) ?? active[0];

  const hasBio = row.bio !== null && row.bio !== undefined && row.bio.trim() !== '';
  const needsBio = !hasBio && Boolean(record.bio && record.bio.trim() !== '');

  const hasHandle = row.handle !== null && row.handle !== undefined && row.handle.trim() !== '';
  const needsHandle = !hasHandle && Boolean(record.handle && record.handle.trim() !== '');

  const hasHighSchool = row.highSchool !== null && row.highSchool !== undefined && row.highSchool.trim() !== '';
  const needsHighSchool = !hasHighSchool && Boolean(record.highSchool && record.highSchool.trim() !== '');

  const hasUniversity = row.university !== null && row.university !== undefined && row.university.trim() !== '';
  const needsUniversity = !hasUniversity && Boolean(record.university && record.university.trim() !== '');

  if (needsBio || needsHandle || needsHighSchool || needsUniversity) {
    return {
      action: 'fill-bio',
      id: row.id,
      fillBio: needsBio ? record.bio : undefined,
      fillHandle: needsHandle ? record.handle : undefined,
      fillHighSchool: needsHighSchool ? record.highSchool : undefined,
      fillUniversity: needsUniversity ? record.university : undefined,
    };
  }

  return { action: 'skip', note: '' };
}

/** Merges records into `leadership`, inserting what is missing and nothing else. */
export async function mergeLeadership(records: LeadershipRecord[]): Promise<MergeResult> {
  const { unique, collapsed } = dedupeRecords(records);
  const notes = collapsed.map((c) => `collapsed duplicate in source: ${c}`);

  // One read, then grouped in memory. Per-row lookups would be ~169 round trips
  // for a table that fits in a single query.
  const rows = await db
    .select({
      id: schema.leadership.id,
      name: schema.leadership.name,
      handle: schema.leadership.handle,
      role: schema.leadership.role,
      year: schema.leadership.year,
      bio: schema.leadership.bio,
      highSchool: schema.leadership.highSchool,
      university: schema.leadership.university,
      deletedAt: schema.leadership.deletedAt,
    })
    .from(schema.leadership);

  const byKey = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = leadershipKey(row);
    const group = byKey.get(key);
    if (group) group.push(row);
    else byKey.set(key, [row]);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const record of unique) {
    const plan = planRecord(record, byKey.get(leadershipKey(record)) ?? []);

    if (plan.action === 'insert') {
      await db.insert(schema.leadership).values({
        memberId: null,
        name: record.name,
        handle: record.handle ?? null,
        role: record.role,
        year: record.year,
        bio: record.bio,
        highSchool: record.highSchool ?? null,
        university: record.university ?? null,
      });
      inserted++;
    } else if (plan.action === 'fill-bio') {
      const updates: Record<string, string | null> = {};
      if (plan.fillBio) updates.bio = plan.fillBio;
      if (plan.fillHandle) updates.handle = plan.fillHandle;
      if (plan.fillHighSchool) updates.highSchool = plan.fillHighSchool;
      if (plan.fillUniversity) updates.university = plan.fillUniversity;

      if (Object.keys(updates).length > 0) {
        await db
          .update(schema.leadership)
          .set(updates)
          .where(and(eq(schema.leadership.id, plan.id)));
        updated++;
      }
    } else {
      skipped++;
      if (plan.note) notes.push(plan.note);
    }
  }

  return { inserted, updated, skipped, notes };
}
