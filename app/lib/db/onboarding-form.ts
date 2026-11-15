import 'server-only';
import { and, count, eq, inArray } from 'drizzle-orm';
import { db } from './index';
import * as schema from './schema';
import type { InviteKind, OnboardingTx } from './onboarding';
import {
  ONBOARDING_FORM_ENTRY_KEY,
  ONBOARDING_FORM_ENTRY_LABEL,
  ONBOARDING_FORM_KEYS,
  ONBOARDING_FORM_URL_KEY,
  ONBOARDING_FORM_URL_LABEL,
} from '@/app/lib/onboarding/google-form/settings';

/**
 * Persistence for `onboarding_form_completions` (spec-051). A row means "the Apps Script webhook
 * confirmed this invite's person submitted the staff Google Form". Rows carry ids and a timestamp
 * only, never form answers.
 */

type DbOrTx = typeof db | OnboardingTx;

/** The invite behind a signed form token, as far as the webhook needs it. */
export async function findInviteStateById(
  kind: InviteKind,
  inviteId: string
): Promise<{ status: string; expiresAt: Date | null } | undefined> {
  const table = kind === 'player' ? schema.playerInvites : schema.managerInvites;
  const [row] = await db
    .select({ status: table.status, expiresAt: table.expiresAt })
    .from(table)
    .where(eq(table.id, inviteId))
    .limit(1);
  return row ? { status: String(row.status), expiresAt: row.expiresAt ?? null } : undefined;
}

/**
 * Records a completion once per invite. Re-delivery (Apps Script retries, a student submitting the
 * form twice) is a no-op. Returns whether this call created the row.
 */
export async function recordFormCompletion(kind: InviteKind, inviteId: string): Promise<boolean> {
  const inserted = await db
    .insert(schema.onboardingFormCompletions)
    .values({ inviteKind: kind, inviteId, source: 'google_form' })
    .onConflictDoNothing({
      target: [schema.onboardingFormCompletions.inviteKind, schema.onboardingFormCompletions.inviteId],
    })
    .returning({ id: schema.onboardingFormCompletions.id });
  return inserted.length > 0;
}

export async function hasFormCompletion(kind: InviteKind, inviteId: string, tx: DbOrTx = db): Promise<boolean> {
  const [row] = await tx
    .select({ id: schema.onboardingFormCompletions.id })
    .from(schema.onboardingFormCompletions)
    .where(
      and(
        eq(schema.onboardingFormCompletions.inviteKind, kind),
        eq(schema.onboardingFormCompletions.inviteId, inviteId)
      )
    )
    .limit(1);
  return Boolean(row);
}

/** Ties the completion to the member the submission just created, so removing the member removes it. */
export async function linkFormCompletionToMember(
  tx: OnboardingTx,
  kind: InviteKind,
  inviteId: string,
  memberId: string
): Promise<void> {
  await tx
    .update(schema.onboardingFormCompletions)
    .set({ memberId })
    .where(
      and(
        eq(schema.onboardingFormCompletions.inviteKind, kind),
        eq(schema.onboardingFormCompletions.inviteId, inviteId)
      )
    );
}

/** Total completions, for the staff page. */
export async function countFormCompletions(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(schema.onboardingFormCompletions);
  return row?.value ?? 0;
}

/**
 * Deletes completions for invites that are being deleted. They are inert, but nothing should
 * outlive the invite they describe. A missing table (migration not applied yet) counts as zero.
 */
export async function deleteFormCompletionsForInvites(
  kind: InviteKind,
  inviteIds: string[],
  tx: DbOrTx = db
): Promise<number> {
  if (inviteIds.length === 0) return 0;
  try {
    const gone = await tx
      .delete(schema.onboardingFormCompletions)
      .where(
        and(
          eq(schema.onboardingFormCompletions.inviteKind, kind),
          inArray(schema.onboardingFormCompletions.inviteId, inviteIds)
        )
      )
      .returning({ id: schema.onboardingFormCompletions.id });
    return gone.length;
  } catch (err) {
    if ((err as { code?: string })?.code === '42P01') return 0;
    throw err;
  }
}

/** The two settings rows, read straight from the database (staff page). */
export async function readOnboardingFormSettingRows(): Promise<{ url: string; entryId: string }> {
  const rows = await db
    .select({ key: schema.pageContent.key, content: schema.pageContent.content })
    .from(schema.pageContent)
    .where(inArray(schema.pageContent.key, [...ONBOARDING_FORM_KEYS]));
  const byKey = new Map(rows.map((r) => [r.key, r.content]));
  return { url: byKey.get(ONBOARDING_FORM_URL_KEY) ?? '', entryId: byKey.get(ONBOARDING_FORM_ENTRY_KEY) ?? '' };
}

/**
 * Writes the settings rows. Empty strings clear the form (onboarding then skips the step). Upserts,
 * so no seed or migration is needed for the rows to exist.
 */
export async function writeOnboardingFormSettingRows(values: { url: string; entryId: string }): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [key, label, content] of [
      [ONBOARDING_FORM_URL_KEY, ONBOARDING_FORM_URL_LABEL, values.url],
      [ONBOARDING_FORM_ENTRY_KEY, ONBOARDING_FORM_ENTRY_LABEL, values.entryId],
    ] as const) {
      await tx
        .insert(schema.pageContent)
        .values({ key, label, content })
        .onConflictDoUpdate({ target: schema.pageContent.key, set: { content } });
    }
  });
}
