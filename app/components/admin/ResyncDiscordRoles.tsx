'use client';

import { useState } from 'react';
import { HiOutlineArrowPath } from 'react-icons/hi2';
import { resyncDiscordRoles } from '@/app/(admin)/admin/schools/[schoolId]/rosters/discord-actions';
import ConfirmActionDialog from '@/app/components/admin/ConfirmActionDialog';
import { useConfirmAction } from '@/app/components/admin/useConfirmAction';
import { PendingLabel } from '@/app/components/admin/AdminUI';
import { secondaryBtnSm } from '@/app/components/admin/styles';
import { TIER_SYNC_FAILURE_LABELS, type TierSyncReport } from '@/app/lib/onboarding/tier-sync-report';

/** One short sentence per non-zero count, so a clean run reads as one line. */
export function summarizeReport(report: TierSyncReport): string {
  const parts = [
    `${report.synced} updated`,
    `${report.unchanged} already correct`,
    report.notInGuild > 0 ? `${report.notInGuild} not in the Discord server` : null,
    report.skippedNoDiscord > 0 ? `${report.skippedNoDiscord} without Discord connected` : null,
    report.failed > 0 ? `${report.failed} failed` : null,
  ].filter(Boolean);
  return `Discord roles resynced: ${parts.join(', ')}.`;
}

/**
 * Staff control to re-derive every member's Discord tier roles for one school. It confirms first
 * because it writes to the live Discord server, then keeps the outcome on screen (a toast would
 * vanish before a list of failures could be read).
 */
export default function ResyncDiscordRoles({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  const [report, setReport] = useState<TierSyncReport | null>(null);
  const flow = useConfirmAction<true>(async () => {
    const res = await resyncDiscordRoles(schoolId);
    if (res.success) setReport(res.report);
    return res;
  });
  const pending = flow.dialogProps.isPending;

  return (
    <div className="space-y-2">
      <button
        type="button"
        className={secondaryBtnSm}
        aria-busy={pending || undefined}
        onClick={() => flow.request(true)}
      >
        <HiOutlineArrowPath aria-hidden className="h-4 w-4" />
        <PendingLabel pending={pending} label="Resync Discord roles" pendingLabel="Resyncing…" />
      </button>

      <ConfirmActionDialog
        {...flow.dialogProps}
        title="Resync Discord roles?"
        message={`This checks every ${schoolName} member against the current rosters and updates their Varsity and JV roles in the EZ Esports Discord server. Other roles are never changed. Large schools can take a minute.`}
        confirmLabel="Resync roles"
        pendingLabel="Resyncing…"
      />

      {report && (
        <div role="status" aria-live="polite" className="rounded-xl bg-surface-raised/50 p-3 text-sm text-foreground-secondary">
          <p className="text-foreground">{summarizeReport(report)}</p>
          {report.failures.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5">
              {report.failures.map((f, i) => (
                <li key={`${f.member}-${i}`}>
                  Member {f.member}: {TIER_SYNC_FAILURE_LABELS[f.reason] ?? 'Failed.'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
