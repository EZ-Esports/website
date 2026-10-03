import 'server-only';

import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from './index';
import * as schema from './schema';
import type {
  AdminCareerPostingWithStats,
  CareerPosting,
  CareerPostingStatus,
  CareerPostingSummary,
} from '@/app/types/careers';

/**
 * Fetch all published, non-deleted career postings for the public careers page.
 */
export async function getPublishedCareerPostings(): Promise<CareerPostingSummary[]> {
  const rows = await db
    .select({
      id: schema.careerPostings.id,
      title: schema.careerPostings.title,
      slug: schema.careerPostings.slug,
      department: schema.careerPostings.department,
      location: schema.careerPostings.location,
      commitment: schema.careerPostings.commitment,
      employmentType: schema.careerPostings.employmentType,
      summary: schema.careerPostings.summary,
      status: schema.careerPostings.status,
      displayOrder: schema.careerPostings.displayOrder,
      createdAt: schema.careerPostings.createdAt,
    })
    .from(schema.careerPostings)
    .where(
      and(
        eq(schema.careerPostings.status, 'published'),
        isNull(schema.careerPostings.deletedAt)
      )
    )
    .orderBy(asc(schema.careerPostings.displayOrder), desc(schema.careerPostings.createdAt));

  return rows.map((r) => ({
    ...r,
    status: r.status as CareerPostingStatus,
  }));
}

/**
 * Fetch a single published career posting by slug for public details.
 */
export async function getPublishedCareerPostingBySlug(slug: string): Promise<CareerPosting | null> {
  const rows = await db
    .select()
    .from(schema.careerPostings)
    .where(
      and(
        eq(schema.careerPostings.slug, slug),
        eq(schema.careerPostings.status, 'published'),
        isNull(schema.careerPostings.deletedAt)
      )
    )
    .limit(1);

  if (!rows[0]) return null;
  const row = rows[0];
  return {
    ...row,
    status: row.status as CareerPostingStatus,
  };
}

/**
 * Fetch a career posting by slug regardless of status (e.g. for checking uniqueness or admin preview).
 */
export async function getCareerPostingBySlug(slug: string): Promise<CareerPosting | null> {
  const rows = await db
    .select()
    .from(schema.careerPostings)
    .where(
      and(
        eq(schema.careerPostings.slug, slug),
        isNull(schema.careerPostings.deletedAt)
      )
    )
    .limit(1);

  if (!rows[0]) return null;
  const row = rows[0];
  return {
    ...row,
    status: row.status as CareerPostingStatus,
  };
}

/**
 * Fetch a career posting by ID.
 */
export async function getCareerPostingById(id: string): Promise<CareerPosting | null> {
  const rows = await db
    .select()
    .from(schema.careerPostings)
    .where(
      and(
        eq(schema.careerPostings.id, id),
        isNull(schema.careerPostings.deletedAt)
      )
    )
    .limit(1);

  if (!rows[0]) return null;
  const row = rows[0];
  return {
    ...row,
    status: row.status as CareerPostingStatus,
  };
}

/**
 * Fetch all non-deleted career postings for the Staff Admin portal,
 * augmented with real-time applicant counts.
 */
export async function getAllCareerPostingsAdmin(): Promise<AdminCareerPostingWithStats[]> {
  const appCounts = db
    .select({
      careerPostingId: schema.staffApplications.careerPostingId,
      totalCount: sql<number>`count(*)::int`.as('total_count'),
    })
    .from(schema.staffApplications)
    .where(isNull(schema.staffApplications.deletedAt))
    .groupBy(schema.staffApplications.careerPostingId)
    .as('app_counts');

  const rows = await db
    .select({
      posting: schema.careerPostings,
      totalApplicants: sql<number>`COALESCE(${appCounts.totalCount}, 0)`.as('total_applicants'),
    })
    .from(schema.careerPostings)
    .leftJoin(appCounts, eq(schema.careerPostings.id, appCounts.careerPostingId))
    .where(isNull(schema.careerPostings.deletedAt))
    .orderBy(asc(schema.careerPostings.displayOrder), desc(schema.careerPostings.createdAt));

  return rows.map(({ posting, totalApplicants }) => ({
    ...posting,
    status: posting.status as CareerPostingStatus,
    applicantCount: Number(totalApplicants) || 0,
    pendingCount: 0,
  }));
}

export interface CreateCareerPostingInput {
  title: string;
  slug: string;
  department: string;
  location?: string;
  commitment?: string;
  employmentType?: string;
  summary: string;
  description: string;
  status?: CareerPostingStatus;
  displayOrder?: number;
}

export async function createCareerPosting(input: CreateCareerPostingInput): Promise<CareerPosting> {
  const [created] = await db
    .insert(schema.careerPostings)
    .values({
      title: input.title.trim(),
      slug: input.slug.trim().toLowerCase(),
      department: input.department.trim(),
      location: input.location?.trim() || 'Remote (NYC High School League)',
      commitment: input.commitment?.trim() || '5–10 hours / week',
      employmentType: input.employmentType?.trim() || 'Volunteer / High School Internship',
      summary: input.summary.trim(),
      description: input.description.trim(),
      status: input.status || 'published',
      displayOrder: input.displayOrder ?? 0,
    })
    .returning();

  return {
    ...created,
    status: created.status as CareerPostingStatus,
  };
}

export interface UpdateCareerPostingInput {
  title?: string;
  slug?: string;
  department?: string;
  location?: string;
  commitment?: string;
  employmentType?: string;
  summary?: string;
  description?: string;
  status?: CareerPostingStatus;
  displayOrder?: number;
}

export async function updateCareerPosting(
  id: string,
  input: UpdateCareerPostingInput
): Promise<CareerPosting | null> {
  const patch: Partial<typeof schema.careerPostings.$inferInsert> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.slug !== undefined) patch.slug = input.slug.trim().toLowerCase();
  if (input.department !== undefined) patch.department = input.department.trim();
  if (input.location !== undefined) patch.location = input.location.trim();
  if (input.commitment !== undefined) patch.commitment = input.commitment.trim();
  if (input.employmentType !== undefined) patch.employmentType = input.employmentType.trim();
  if (input.summary !== undefined) patch.summary = input.summary.trim();
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.status !== undefined) patch.status = input.status;
  if (input.displayOrder !== undefined) patch.displayOrder = input.displayOrder;

  const [updated] = await db
    .update(schema.careerPostings)
    .set(patch)
    .where(and(eq(schema.careerPostings.id, id), isNull(schema.careerPostings.deletedAt)))
    .returning();

  if (!updated) return null;
  return {
    ...updated,
    status: updated.status as CareerPostingStatus,
  };
}

export async function softDeleteCareerPosting(id: string, deletedBy: string): Promise<boolean> {
  const [deleted] = await db
    .update(schema.careerPostings)
    .set({
      deletedAt: new Date(),
      deletedBy,
    })
    .where(and(eq(schema.careerPostings.id, id), isNull(schema.careerPostings.deletedAt)))
    .returning();

  return !!deleted;
}
