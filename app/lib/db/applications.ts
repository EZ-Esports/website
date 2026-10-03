import 'server-only';
import { db } from './index';
import * as schema from './schema';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { ApplicationStatus } from '@/app/lib/application-status';

export type { ApplicationStatus };

/** Subquery resolving the latest status log for each application */
function getLatestStatusLogSubquery(type: 'school' | 'staff') {
  return db
    .select({
      applicationId: schema.applicationStatusLogs.applicationId,
      applicationType: schema.applicationStatusLogs.applicationType,
      status: schema.applicationStatusLogs.status,
      rn: sql<number>`row_number() over (
        partition by ${schema.applicationStatusLogs.applicationType}, ${schema.applicationStatusLogs.applicationId}
        order by ${schema.applicationStatusLogs.createdAt} desc, ${schema.applicationStatusLogs.id} desc
      )`.as('rn'),
    })
    .from(schema.applicationStatusLogs)
    .where(eq(schema.applicationStatusLogs.applicationType, type))
    .as('latest_logs');
}

export function buildSchoolApplicationsQuery(statusFilter?: ApplicationStatus | 'all') {
  const latestLogs = getLatestStatusLogSubquery('school');

  const query = db
    .select({
      id: schema.schoolApplications.id,
      applicantName: schema.schoolApplications.applicantName,
      schoolName: schema.schoolApplications.schoolName,
      role: schema.schoolApplications.role,
      email: schema.schoolApplications.email,
      details: schema.schoolApplications.details,
      submittedAt: schema.schoolApplications.submittedAt,
      status: sql<ApplicationStatus>`COALESCE(${latestLogs.status}, 'pending')`.as('effective_status'),
    })
    .from(schema.schoolApplications)
    .leftJoin(
      latestLogs,
      and(
        eq(schema.schoolApplications.id, latestLogs.applicationId),
        sql`"rn" = 1`
      )
    );

  const conditions = [isNull(schema.schoolApplications.deletedAt)];

  if (statusFilter === 'pending') {
    conditions.push(or(isNull(latestLogs.status), eq(latestLogs.status, 'pending'))!);
  } else if (statusFilter && statusFilter !== 'all') {
    conditions.push(eq(latestLogs.status, statusFilter));
  }

  return query.where(and(...conditions)).orderBy(desc(schema.schoolApplications.submittedAt));
}

export const getSchoolApplications = buildSchoolApplicationsQuery;

export function buildStaffApplicationsQuery(
  statusFilter?: ApplicationStatus | 'all',
  careerPostingId?: string
) {
  const latestLogs = getLatestStatusLogSubquery('staff');

  const query = db
    .select({
      id: schema.staffApplications.id,
      careerPostingId: schema.staffApplications.careerPostingId,
      name: schema.staffApplications.name,
      preferredFirstName: schema.staffApplications.preferredFirstName,
      email: schema.staffApplications.email,
      phone: schema.staffApplications.phone,
      discordTag: schema.staffApplications.discordTag,
      role: schema.staffApplications.role,
      details: schema.staffApplications.details,
      // Only whether a resume exists: the storage key stays server-side and
      // admins open the file through the signed-URL route.
      hasResume: sql<boolean>`${schema.staffApplications.resumeStorageKey} IS NOT NULL`.as('has_resume'),
      submittedAt: schema.staffApplications.submittedAt,
      status: sql<ApplicationStatus>`COALESCE(${latestLogs.status}, 'pending')`.as('effective_status'),
    })
    .from(schema.staffApplications)
    .leftJoin(
      latestLogs,
      and(
        eq(schema.staffApplications.id, latestLogs.applicationId),
        sql`"rn" = 1`
      )
    );

  const conditions = [isNull(schema.staffApplications.deletedAt)];

  if (careerPostingId) {
    conditions.push(eq(schema.staffApplications.careerPostingId, careerPostingId));
  }

  if (statusFilter === 'pending') {
    conditions.push(or(isNull(latestLogs.status), eq(latestLogs.status, 'pending'))!);
  } else if (statusFilter && statusFilter !== 'all') {
    conditions.push(eq(latestLogs.status, statusFilter));
  }

  return query.where(and(...conditions)).orderBy(desc(schema.staffApplications.submittedAt));
}

export const getStaffApplications = buildStaffApplicationsQuery;

/**
 * The resume key for one staff application, excluding soft-deleted rows so a
 * removed application's resume can no longer be opened from the admin panel.
 */
export function buildStaffResumeKeyQuery(applicationId: string) {
  return db
    .select({ resumeStorageKey: schema.staffApplications.resumeStorageKey })
    .from(schema.staffApplications)
    .where(and(eq(schema.staffApplications.id, applicationId), isNull(schema.staffApplications.deletedAt)))
    .limit(1);
}

export async function getStaffResumeStorageKey(applicationId: string): Promise<string | null> {
  const [row] = await buildStaffResumeKeyQuery(applicationId);
  return row?.resumeStorageKey ?? null;
}

export interface ApplicationStatusRecord {
  id: string;
  isDeleted: boolean;
  currentStatus: ApplicationStatus;
}

/**
 * Retrieves the current status state of an application (school or staff)
 * along with its deletion status, resolving the latest status log.
 */
export async function getApplicationStatusState(
  id: string,
  type: 'school' | 'staff'
): Promise<ApplicationStatusRecord | null> {
  const table = type === 'school' ? schema.schoolApplications : schema.staffApplications;
  const [app] = await db
    .select({ id: table.id, deletedAt: table.deletedAt })
    .from(table)
    .where(eq(table.id, id))
    .limit(1);

  if (!app) return null;

  const [latestLog] = await db
    .select({ status: schema.applicationStatusLogs.status })
    .from(schema.applicationStatusLogs)
    .where(
      and(
        eq(schema.applicationStatusLogs.applicationId, id),
        eq(schema.applicationStatusLogs.applicationType, type)
      )
    )
    .orderBy(desc(schema.applicationStatusLogs.createdAt), desc(schema.applicationStatusLogs.id))
    .limit(1);

  return {
    id: app.id,
    isDeleted: app.deletedAt !== null,
    currentStatus: latestLog?.status ?? 'pending',
  };
}

/**
 * Records an application status transition log.
 */
export async function recordApplicationStatusChange(params: {
  applicationId: string;
  applicationType: 'school' | 'staff';
  status: ApplicationStatus;
  actorUserId: string;
  actorEmail: string;
  reason?: string | null;
}) {
  return db.insert(schema.applicationStatusLogs).values({
    applicationId: params.applicationId,
    applicationType: params.applicationType,
    status: params.status,
    actorUserId: params.actorUserId,
    actorEmail: params.actorEmail,
    reason: params.reason ?? null,
  });
}

/**
 * Soft deletes an application by marking deletedAt and deletedBy.
 */
export async function softDeleteApplicationRecord(
  id: string,
  type: 'school' | 'staff',
  staffUserId: string
) {
  const table = type === 'school' ? schema.schoolApplications : schema.staffApplications;
  return db
    .update(table)
    .set({
      deletedAt: new Date(),
      deletedBy: staffUserId,
    })
    .where(eq(table.id, id));
}
