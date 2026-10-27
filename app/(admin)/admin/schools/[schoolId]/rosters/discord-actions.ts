'use server';
import { eq } from 'drizzle-orm';
import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { memberInSchool } from '@/app/lib/db/roster-scope';
import { syncTierRolesForMembers } from '@/app/lib/onboarding/tier-role-sync';
import type { TierSyncReport } from '@/app/lib/onboarding/tier-sync-report';

/**
 * Staff "Resync Discord roles". Re-derives the Discord tier roles of one member, or of every
 * member of the school, from the database and applies the difference. The outcome is returned as
 * a result object, never thrown: Next.js masks the message of an error thrown from a server action
 * in production, and a partial failure (one student not in the server) is an ordinary outcome.
 */

export type ResyncDiscordRolesResult =
  | { success: true; report: TierSyncReport }
  | { success: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resyncDiscordRoles(schoolId: string, memberId?: string): Promise<ResyncDiscordRolesResult> {
  await requirePermission(Permissions.MANAGE_ROSTERS);
  if (!UUID.test(schoolId)) return { success: false, error: 'Invalid school.' };
  if (memberId !== undefined && !UUID.test(memberId)) return { success: false, error: 'Invalid member.' };

  try {
    let memberIds: string[];
    if (memberId) {
      if (!(await memberInSchool(memberId, schoolId))) {
        return { success: false, error: 'That member was not found for this school.' };
      }
      memberIds = [memberId];
    } else {
      // Every member of the school, not only those on a roster now: someone just removed from their
      // last roster has no player row left but still needs the tier roles taken away.
      const rows = await db
        .select({ id: schema.members.id })
        .from(schema.members)
        .where(eq(schema.members.schoolId, schoolId));
      memberIds = rows.map((r) => r.id);
    }

    const report = await syncTierRolesForMembers(memberIds);
    if (report.status === 'disabled') {
      return { success: false, error: DISABLED_MESSAGES[report.disabledReason ?? 'config_unset'] };
    }
    return { success: true, report };
  } catch (error) {
    console.error('resyncDiscordRoles failed:', error instanceof Error ? error.name : 'unknown error');
    return { success: false, error: 'Could not resync Discord roles. Try again in a moment.' };
  }
}

const DISABLED_MESSAGES = {
  config_unset: 'Discord tier role sync is not turned on. Set DISCORD_TIER_ROLES to enable it.',
  config_invalid: 'DISCORD_TIER_ROLES is malformed, so the sync is off. Check the server log for what to fix.',
  discord_unconfigured: 'The Discord bot is not configured (DISCORD_BOT_TOKEN or DISCORD_GUILD_ID is missing).',
} as const;
