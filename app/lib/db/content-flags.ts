import 'server-only';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from './index';
import * as schema from './schema';
import { dbErrorChain } from '@/app/lib/text-utils';
import type { FlaggedField } from '@/app/lib/onboarding/content-check';

/**
 * Persistence for onboarding content-flag overrides (table `onboarding_content_flags`, migration 0055).
 *
 * The table can be missing for a while: production may run this code before the migration is
 * applied. Nothing here may take down onboarding or a roster page for that reason, so every
 * statement is guarded and a missing relation degrades to "no record / nothing to show" with a
 * warning. Any other database error is still raised, so real failures are not swallowed.
 */

const UNDEFINED_TABLE = '42P01';
const UNDEFINED_COLUMN = '42703';
const TABLE_NAME = 'onboarding_content_flags';

/** True only for a Postgres "undefined table/column" error that names the content-flags table. */
export function isMissingContentFlagsError(err: unknown): boolean {
  return dbErrorChain(err).some((e) => {
    const { code, message } = e as { code?: unknown; message?: unknown };
    return (
      (code === UNDEFINED_TABLE || code === UNDEFINED_COLUMN) &&
      typeof message === 'string' &&
      message.includes(TABLE_NAME)
    );
  });
}

function warnMissing(action: string): void {
  console.warn(`${TABLE_NAME} is missing; apply migration 0055. Skipped: ${action}.`);
}

/** The transaction handle the onboarding pipeline passes around, or the root client. */
type Executor = Pick<typeof db, 'insert' | 'select' | 'update' | 'transaction'>;

export interface InsertContentFlagInput {
  memberId: string;
  schoolId: string | null;
  inviteKind: 'player' | 'manager';
  inviteId: string;
  fields: FlaggedField[];
}

export function toStoredFields(fields: FlaggedField[]): schema.StoredFlaggedField[] {
  return fields.map((f) => ({
    field: f.field,
    label: f.label,
    value: f.value,
    matchedTerms: [...new Set(f.matches.map((m) => m.term))],
    languages: [...new Set(f.matches.map((m) => m.language))],
  }));
}

/**
 * Records that this person overrode the warning on these fields. Runs inside a savepoint so that a
 * missing table aborts only the savepoint and the surrounding onboarding transaction carries on.
 * Returns false when nothing was recorded because the migration is not applied.
 */
export async function insertContentFlag(tx: Executor, input: InsertContentFlagInput): Promise<boolean> {
  if (input.fields.length === 0) return true;
  try {
    await tx.transaction(async (savepoint) => {
      await savepoint.insert(schema.onboardingContentFlags).values({
        memberId: input.memberId,
        schoolId: input.schoolId,
        inviteKind: input.inviteKind,
        inviteId: input.inviteId,
        flaggedFields: toStoredFields(input.fields),
      });
    });
    return true;
  } catch (err) {
    if (!isMissingContentFlagsError(err)) throw err;
    warnMissing('recording an onboarding content-flag override');
    return false;
  }
}

export interface ContentFlagView {
  id: string;
  memberId: string;
  inviteKind: 'player' | 'manager';
  fields: { field: string; label: string; value: string; matchedTerms: string[]; languages: string[] }[];
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

function toView(row: typeof schema.onboardingContentFlags.$inferSelect): ContentFlagView {
  return {
    id: row.id,
    memberId: row.memberId,
    inviteKind: row.inviteKind === 'manager' ? 'manager' : 'player',
    fields: Array.isArray(row.flaggedFields) ? row.flaggedFields : [],
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    reviewedBy: row.reviewedBy,
  };
}

/**
 * Override records for these members, newest first per member. Always a separate query from the
 * roster read, so a missing table leaves the roster intact and only drops the badge.
 */
export async function getContentFlagsByMember(memberIds: string[]): Promise<Map<string, ContentFlagView>> {
  const out = new Map<string, ContentFlagView>();
  if (memberIds.length === 0) return out;
  try {
    const rows = await db
      .select()
      .from(schema.onboardingContentFlags)
      .where(inArray(schema.onboardingContentFlags.memberId, memberIds))
      .orderBy(desc(schema.onboardingContentFlags.createdAt));
    for (const row of rows) {
      // Rows are newest first; keep the newest unreviewed one if any, else the newest.
      const existing = out.get(row.memberId);
      if (!existing || (existing.reviewedAt && !row.reviewedAt)) out.set(row.memberId, toView(row));
    }
  } catch (err) {
    if (!isMissingContentFlagsError(err)) throw err;
    warnMissing('reading content-flag overrides for a roster view');
    return new Map();
  }
  return out;
}

/** Marks an override record reviewed. False when the record or the table does not exist. */
export async function markContentFlagReviewed(flagId: string, staffUserId: string): Promise<boolean> {
  try {
    const updated = await db
      .update(schema.onboardingContentFlags)
      .set({ reviewedAt: new Date(), reviewedBy: staffUserId })
      .where(eq(schema.onboardingContentFlags.id, flagId))
      .returning({ id: schema.onboardingContentFlags.id });
    return updated.length > 0;
  } catch (err) {
    if (!isMissingContentFlagsError(err)) throw err;
    warnMissing('marking a content flag reviewed');
    return false;
  }
}
