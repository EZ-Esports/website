/**
 * Data Backfill Script for Leadership Architecture Refactor
 *
 * Normalizes legacy rows from `leadership` into `people` and `leadership_terms`.
 * - Deduplicates people by normalized name and memberId.
 * - Extracts high schools, universities, bios, handles, and avatars.
 * - Categorizes roles into seniority levels (Executive -> Directors -> Associates -> Advisors).
 * - Creates historical `leadership_terms` referencing the canonical person.
 *
 * Run: npx tsx --env-file-if-exists=.env db/backfill-leadership.ts
 */
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';

export function classifyRole(role: string): { displayOrder: number; department: string } {
  const lower = role.toLowerCase().trim();

  // 1. Executive (President, Founder, CTO, VP, CEO)
  if (
    lower === 'president' ||
    lower === 'founder' ||
    lower === 'cto' ||
    lower === 'ceo' ||
    lower === 'co-founder' ||
    lower.includes('vice president') ||
    lower.includes('executive')
  ) {
    return { displayOrder: 1, department: 'Executive' };
  }

  // 4. Advisors & Special Thanks
  if (
    lower.includes('advisor') ||
    lower.includes('special thanks') ||
    lower.includes('consultant')
  ) {
    return { displayOrder: 4, department: 'Advisors' };
  }

  // 2. Directors / Leads
  if (
    lower.includes('director') ||
    lower.includes('lead') ||
    lower.includes('head')
  ) {
    let dept = role
      .replace(/\b(Co-Director|Director|Co-Lead|Lead|Head)\b/gi, '')
      .trim();
    if (!dept) dept = 'Directors';
    return { displayOrder: 2, department: dept };
  }

  // 3. Associates / Staff / Engineers / Coordinators
  if (
    lower.includes('associate') ||
    lower.includes('staff') ||
    lower.includes('engineer') ||
    lower.includes('coordinator') ||
    lower.includes('manager')
  ) {
    let dept = role
      .replace(/\b(Associate|Staff|Software Engineer|Engineer|Coordinator|Manager)\b/gi, '')
      .trim();
    if (!dept) dept = 'Staff';
    return { displayOrder: 3, department: dept };
  }

  // Default: Associates / Staff
  return { displayOrder: 3, department: 'Staff' };
}

interface PersonAgg {
  fullName: string;
  handle: string | null;
  bio: string | null;
  highSchool: string | null;
  university: string | null;
  memberId: string | null;
  rows: (typeof schema.leadership.$inferSelect)[];
}

async function backfill() {
  console.log('🚀 Starting Leadership Normalization & Backfill...');

  // 1. Fetch all rows from legacy leadership
  const legacyRows = await db.select().from(schema.leadership);
  console.log(`Found ${legacyRows.length} legacy leadership rows in total.`);

  // 2. Group into unique persons
  const peopleMap = new Map<string, PersonAgg>();

  for (const row of legacyRows) {
    const normName = row.name.trim().toLowerCase();
    const groupKey = normName;

    if (!peopleMap.has(groupKey)) {
      peopleMap.set(groupKey, {
        fullName: row.name.trim(),
        handle: row.handle?.trim() || null,
        bio: row.bio?.trim() || null,
        highSchool: row.highSchool?.trim() || null,
        university: row.university?.trim() || null,
        memberId: row.memberId || null,
        rows: [row],
      });
    } else {
      const existing = peopleMap.get(groupKey)!;
      existing.rows.push(row);
      if (!existing.handle && row.handle?.trim()) {
        existing.handle = row.handle.trim();
      }
      if (!existing.bio && row.bio?.trim()) {
        existing.bio = row.bio.trim();
      }
      if (!existing.highSchool && row.highSchool?.trim()) {
        existing.highSchool = row.highSchool.trim();
      }
      if (!existing.university && row.university?.trim()) {
        existing.university = row.university.trim();
      }
      if (!existing.memberId && row.memberId) {
        existing.memberId = row.memberId;
      }
    }
  }

  console.log(`Deduplicated into ${peopleMap.size} unique people profiles.`);

  // 3. Check existing people
  const existingPeople = await db.select().from(schema.people);
  const existingByName = new Map<string, typeof schema.people.$inferSelect>();
  for (const p of existingPeople) {
    existingByName.set(p.fullName.trim().toLowerCase(), p);
  }

  const personIdByName = new Map<string, string>();
  const toInsertPeople: (typeof schema.people.$inferInsert)[] = [];

  for (const [key, agg] of peopleMap.entries()) {
    const existing = existingByName.get(key);
    if (existing) {
      personIdByName.set(key, existing.id);
    } else {
      toInsertPeople.push({
        fullName: agg.fullName,
        handle: agg.handle,
        bio: agg.bio,
        highSchool: agg.highSchool,
        university: agg.university,
        memberId: agg.memberId,
        isActive: true,
      });
    }
  }

  // Batch insert new people
  if (toInsertPeople.length > 0) {
    console.log(`Batch inserting ${toInsertPeople.length} new people...`);
    const inserted = await db.insert(schema.people).values(toInsertPeople).returning();
    for (const p of inserted) {
      personIdByName.set(p.fullName.trim().toLowerCase(), p.id);
    }
  }

  console.log(`✅ People map resolved with ${personIdByName.size} profiles.`);

  // 4. Batch backfill leadership terms
  const existingTerms = await db.select().from(schema.leadershipTerms);
  const existingTermSet = new Set<string>();
  for (const t of existingTerms) {
    if (!t.deletedAt) {
      existingTermSet.add(`${t.personId}|${t.year}|${t.role.toLowerCase()}`);
    }
  }

  const toInsertTerms: (typeof schema.leadershipTerms.$inferInsert)[] = [];
  const seenBatchTermSet = new Set<string>();

  for (const row of legacyRows) {
    const normName = row.name.trim().toLowerCase();
    const personId = personIdByName.get(normName);

    if (!personId) {
      console.warn(`Could not resolve personId for: ${row.name}`);
      continue;
    }

    const termKey = `${personId}|${row.year}|${row.role.toLowerCase()}`;
    if (existingTermSet.has(termKey) || seenBatchTermSet.has(termKey)) {
      continue;
    }
    seenBatchTermSet.add(termKey);

    const { displayOrder, department } = classifyRole(row.role);

    toInsertTerms.push({
      personId,
      year: row.year,
      role: row.role,
      department,
      displayOrder,
      termBio: row.bio?.trim() || null,
      deletedAt: row.deletedAt,
      deletedBy: row.deletedBy,
    });
  }

  if (toInsertTerms.length > 0) {
    console.log(`Batch inserting ${toInsertTerms.length} leadership terms...`);
    // Insert in chunks of 50 to stay well under query size limits
    const CHUNK_SIZE = 50;
    for (let i = 0; i < toInsertTerms.length; i += CHUNK_SIZE) {
      const chunk = toInsertTerms.slice(i, i + CHUNK_SIZE);
      await db.insert(schema.leadershipTerms).values(chunk);
    }
  }

  const finalPeopleCount = await db.select().from(schema.people);
  const finalTermsCount = await db.select().from(schema.leadershipTerms);

  console.log(`🎉 Backfill completed!`);
  console.log(`📊 Final counts: ${finalPeopleCount.length} people, ${finalTermsCount.length} leadership terms.`);
}

if (process.argv[1] && process.argv[1].includes('backfill-leadership')) {
  backfill()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Backfill failed:', err);
      process.exit(1);
    });
}
