import 'server-only';
import { db } from './index';
import * as schema from './schema';
import { eq } from 'drizzle-orm';
import { hasPermission, Permissions } from '@/app/lib/roles';

/**
 * Error raised when an unauthorized staff actor attempts to read protected student PII / demographics.
 */
export class ForbiddenPiiAccessError extends Error {
  code = 'FORBIDDEN_PII_ACCESS';
  constructor(message = 'FORBIDDEN_PII_ACCESS') {
    super(message);
    this.name = 'ForbiddenPiiAccessError';
  }
}

/**
 * Builds the drizzle select query for a member's student demographics.
 * Useful for query inspection and SQL verification tests.
 */
export function buildStudentDemographicsQuery(memberId: string) {
  return db
    .select()
    .from(schema.studentDemographics)
    .where(eq(schema.studentDemographics.memberId, memberId))
    .limit(1);
}

/**
 * Fetches demographic data for a student member.
 * STRICT RLS PROTECTION: Only staff with VIEW_STUDENT_DEMOGRAPHICS (or Administrator/Owner)
 * are permitted to view student demographic and equity PII.
 *
 * Never wrapped in unstable_cache to preserve zero-PII cache invariant.
 */
export async function getStudentDemographics(
  memberId: string,
  actorPermissions: bigint,
  actorIsOwner: boolean,
  options?: { throwOnForbidden?: boolean }
) {
  if (!hasPermission(actorPermissions, actorIsOwner, Permissions.VIEW_STUDENT_DEMOGRAPHICS)) {
    if (options?.throwOnForbidden === false) {
      return null;
    }
    throw new ForbiddenPiiAccessError();
  }

  const [row] = await buildStudentDemographicsQuery(memberId);
  return row ?? null;
}
