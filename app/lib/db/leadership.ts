import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from './index';
import * as schema from './schema';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

export const getCachedLeadership = unstable_cache(
  async () => {
    return db
      .select({
        id: schema.leadershipTerms.id,
        termId: schema.leadershipTerms.id,
        personId: schema.people.id,
        memberId: schema.people.memberId,
        name: schema.people.fullName,
        handle: schema.people.handle,
        role: schema.leadershipTerms.role,
        department: schema.leadershipTerms.department,
        year: schema.leadershipTerms.year,
        displayOrder: schema.leadershipTerms.displayOrder,
        bio: sql<string | null>`COALESCE(${schema.leadershipTerms.termBio}, ${schema.people.bio})`,
        highSchool: schema.people.highSchool,
        university: schema.people.university,
        avatarUrl: schema.people.avatarUrl,
        storageKey: schema.people.storageKey,
        schoolName: schema.schools.name,
        graduationYear: sql<number | null>`COALESCE(${schema.people.graduationYear}, ${schema.members.graduationYear})`,
      })
      .from(schema.leadershipTerms)
      .innerJoin(schema.people, eq(schema.leadershipTerms.personId, schema.people.id))
      .leftJoin(schema.members, eq(schema.people.memberId, schema.members.id))
      .leftJoin(schema.schools, eq(schema.members.schoolId, schema.schools.id))
      .where(and(isNull(schema.leadershipTerms.deletedAt), isNull(schema.people.deletedAt)))
      .orderBy(
        desc(schema.leadershipTerms.year),
        asc(schema.leadershipTerms.displayOrder),
        asc(schema.leadershipTerms.role),
        asc(schema.people.fullName)
      );
  },
  ['leadership-list'],
  { tags: ['leadership', 'people', 'schools'] }
);

export const getCachedPeople = unstable_cache(
  async () => {
    return db
      .select({
        id: schema.people.id,
        fullName: schema.people.fullName,
        preferredName: schema.people.preferredName,
        handle: schema.people.handle,
        avatarUrl: schema.people.avatarUrl,
        storageKey: schema.people.storageKey,
        highSchool: schema.people.highSchool,
        university: schema.people.university,
        graduationYear: schema.people.graduationYear,
        bio: schema.people.bio,
        memberId: schema.people.memberId,
        isActive: schema.people.isActive,
      })
      .from(schema.people)
      .where(and(eq(schema.people.isActive, true), isNull(schema.people.deletedAt)))
      .orderBy(asc(schema.people.fullName));
  },
  ['people-list'],
  { tags: ['leadership', 'people'] }
);

/**
 * Soft deletes a leader term and any legacy leadership row.
 */
export async function softDeleteLeaderRecord(id: string, userId: string): Promise<void> {
  await db
    .update(schema.leadershipTerms)
    .set({ deletedAt: new Date(), deletedBy: userId })
    .where(eq(schema.leadershipTerms.id, id));

  await db
    .update(schema.leadership)
    .set({ deletedAt: new Date(), deletedBy: userId })
    .where(eq(schema.leadership.id, id));
}
