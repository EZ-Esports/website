/**
 * Merging leadership records into normalized people and leadership_terms tables.
 *
 * Each individual is mapped to a canonical profile in `people` keyed on their
 * normalized full name (`personKey`).
 * Each appointment is mapped to `leadership_terms` keyed on `(person_id, year, role)` (`termKey`).
 *
 * Rules:
 *   - Multiple distinct roles held by the same person in the same year or contiguous
 *     terms are preserved without data loss.
 *   - Duplicate rows in the source sharing (person, year, role) are deduplicated,
 *     preferring any present bio or profile details.
 *   - Existing bios and custom details are never overwritten, only filled when blank.
 *   - Soft-deleted rows are matched and respected (never resurrected).
 *   - Seeded records populate `people` and `leadership_terms`, with a documented
 *     compatibility write to legacy `leadership`.
 */
import { eq } from 'drizzle-orm';
import { db } from '../app/lib/db';
import * as schema from '../app/lib/db/schema';
import { classifyRole } from '../app/lib/leadership';

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

/** The stable person identity, normalized so whitespace and casing cannot fork a profile. */
export function personKey(r: { name: string }): string {
  return r.name.trim().toLowerCase();
}

/** The term identity, unique per (person, year, role). */
export function termKey(r: { name: string; year: string; role: string }): string {
  return [r.name, r.year, r.role].map((v) => v.trim().toLowerCase()).join('|');
}

/**
 * Backward-compatible identity helper. If role is provided, keys on (name, year, role);
 * otherwise keys on (name, year).
 */
export function leadershipKey(r: { name: string; year: string; role?: string }): string {
  if (r.role) {
    return [r.name, r.year, r.role].map((v) => v.trim().toLowerCase()).join('|');
  }
  return [r.name, r.year].map((v) => v.trim().toLowerCase()).join('|');
}

/**
 * Collapses duplicate source records that share an exact (person, year, role) identity,
 * keeping the first and preferring any bio or metadata among them.
 * Records representing distinct roles for the same person in the same year are preserved.
 */
export function dedupeRecords(records: LeadershipRecord[]): {
  unique: LeadershipRecord[];
  collapsed: string[];
} {
  const byKey = new Map<string, LeadershipRecord>();
  const collapsed: string[] = [];

  for (const r of records) {
    const key = termKey(r);
    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, { ...r });
      continue;
    }
    collapsed.push(`${r.name} (${r.year} - ${r.role})`);
    if (!seen.bio && r.bio) seen.bio = r.bio;
    if (!seen.handle && r.handle) seen.handle = r.handle;
    if (!seen.highSchool && r.highSchool) seen.highSchool = r.highSchool;
    if (!seen.university && r.university) seen.university = r.university;
  }

  return { unique: [...byKey.values()], collapsed };
}

/**
 * Decides what a single record should do against the existing term rows for this person & year.
 *
 * Multiple roles for the same person in the same year are cleanly supported: if no active
 * or soft-deleted term exists for the specific role, an insert plan is returned.
 */
export function planRecord(
  record: LeadershipRecord,
  existing: {
    id: string;
    role?: string;
    bio: string | null;
    handle?: string | null;
    highSchool?: string | null;
    university?: string | null;
    deletedAt: Date | null;
  }[]
):
  | { action: 'insert' }
  | {
      action: 'fill-bio';
      id: string;
      fillBio?: string | null;
      fillHandle?: string | null;
      fillHighSchool?: string | null;
      fillUniversity?: string | null;
    }
  | { action: 'skip'; note: string } {
  if (existing.length === 0) return { action: 'insert' };

  // Match existing rows for this specific role
  const matching = existing.filter(
    (r) => r.role && r.role.trim().toLowerCase() === record.role.trim().toLowerCase()
  );

  // If no term with this role exists yet, insert the distinct role (even if other roles exist in this year)
  if (matching.length === 0) {
    return { action: 'insert' };
  }

  const active = matching.filter((r) => r.deletedAt === null);

  if (active.length === 0) {
    return {
      action: 'skip',
      note: `${record.name} (${record.year} - ${record.role}) is soft-deleted; not resurrecting it`,
    };
  }

  const row = active[0];

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

/** Merges records into `people` and `leadership_terms`, inserting what is missing and nothing else. */
export async function mergeLeadership(records: LeadershipRecord[]): Promise<MergeResult> {
  const { unique, collapsed } = dedupeRecords(records);
  const notes = collapsed.map((c) => `collapsed duplicate in source: ${c}`);

  // 1. Fetch existing people
  const existingPeople = await db
    .select({
      id: schema.people.id,
      fullName: schema.people.fullName,
      handle: schema.people.handle,
      bio: schema.people.bio,
      highSchool: schema.people.highSchool,
      university: schema.people.university,
      deletedAt: schema.people.deletedAt,
    })
    .from(schema.people);

  const peopleByKey = new Map<string, typeof existingPeople[0]>();
  for (const p of existingPeople) {
    peopleByKey.set(personKey({ name: p.fullName }), p);
  }

  // 2. Fetch existing leadership_terms
  const existingTerms = await db
    .select({
      id: schema.leadershipTerms.id,
      personId: schema.leadershipTerms.personId,
      year: schema.leadershipTerms.year,
      role: schema.leadershipTerms.role,
      department: schema.leadershipTerms.department,
      displayOrder: schema.leadershipTerms.displayOrder,
      termBio: schema.leadershipTerms.termBio,
      deletedAt: schema.leadershipTerms.deletedAt,
    })
    .from(schema.leadershipTerms);

  const termsByPersonYear = new Map<string, typeof existingTerms>();
  for (const t of existingTerms) {
    const key = `${t.personId}|${t.year.trim()}`;
    const group = termsByPersonYear.get(key);
    if (group) group.push(t);
    else termsByPersonYear.set(key, [t]);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const record of unique) {
    const pKey = personKey(record);
    let person = peopleByKey.get(pKey);

    if (!person) {
      // Insert new person
      const [newPerson] = await db
        .insert(schema.people)
        .values({
          fullName: record.name.trim(),
          handle: record.handle?.trim() || null,
          bio: record.bio?.trim() || null,
          highSchool: record.highSchool?.trim() || null,
          university: record.university?.trim() || null,
          isActive: true,
        })
        .returning();
      person = newPerson;
      peopleByKey.set(pKey, person);
    } else {
      // Fill blank details if record provides them
      const personUpdates: Partial<typeof schema.people.$inferInsert> = {};
      if (!person.bio && record.bio?.trim()) personUpdates.bio = record.bio.trim();
      if (!person.handle && record.handle?.trim()) personUpdates.handle = record.handle.trim();
      if (!person.highSchool && record.highSchool?.trim()) personUpdates.highSchool = record.highSchool.trim();
      if (!person.university && record.university?.trim()) personUpdates.university = record.university.trim();

      if (Object.keys(personUpdates).length > 0) {
        await db
          .update(schema.people)
          .set(personUpdates)
          .where(eq(schema.people.id, person.id));
        Object.assign(person, personUpdates);
      }
    }

    const termGroupKey = `${person.id}|${record.year.trim()}`;
    const termsForPersonYear = termsByPersonYear.get(termGroupKey) ?? [];

    const existingForPlan = termsForPersonYear.map((t) => ({
      id: t.id,
      role: t.role,
      bio: t.termBio || person!.bio,
      handle: person!.handle,
      highSchool: person!.highSchool,
      university: person!.university,
      deletedAt: t.deletedAt,
    }));

    const plan = planRecord(record, existingForPlan);

    if (plan.action === 'insert') {
      const { displayOrder, department } = classifyRole(record.role);
      const [newTerm] = await db
        .insert(schema.leadershipTerms)
        .values({
          personId: person.id,
          year: record.year.trim(),
          role: record.role.trim(),
          department,
          displayOrder,
          termBio: record.bio?.trim() || null,
        })
        .returning();

      termsForPersonYear.push(newTerm);
      termsByPersonYear.set(termGroupKey, termsForPersonYear);
      inserted++;

      // Backward-compatibility shim for legacy leadership table
      try {
        await db.insert(schema.leadership).values({
          name: record.name.trim(),
          handle: record.handle?.trim() || null,
          role: record.role.trim(),
          year: record.year.trim(),
          bio: record.bio?.trim() || null,
          highSchool: record.highSchool?.trim() || null,
          university: record.university?.trim() || null,
        });
      } catch {
        // Safe to ignore legacy sync errors
      }
    } else if (plan.action === 'fill-bio') {
      if (plan.fillBio) {
        await db
          .update(schema.leadershipTerms)
          .set({ termBio: plan.fillBio })
          .where(eq(schema.leadershipTerms.id, plan.id));
      }
      updated++;
    } else {
      skipped++;
      if (plan.note) notes.push(plan.note);
    }
  }

  return { inserted, updated, skipped, notes };
}
