'use client';

import { useEffect, useRef } from 'react';
import { Button } from 'react-aria-components';
import { HiOutlineClipboardDocument, HiOutlineTrash } from 'react-icons/hi2';
import type { SchoolInviteItem } from '@/app/lib/onboarding/portal-actions';

interface InvitesHistoryTableProps {
  invites: SchoolInviteItem[];
  /** Asks to issue and copy a fresh link (the stored hash cannot be turned back into the old one). */
  onCopyLink: (invite: SchoolInviteItem) => void;
  onDelete: (invite: SchoolInviteItem) => void;
  /** Games whose season is inactive (view-only): their invites cannot be changed (spec-028). */
  viewOnlyGameIds?: string[];
  /** Id of the invite whose new link was just copied. */
  copiedId?: string | null;
  /** Shown when the clipboard refused the write, so the manager can copy the link by hand. */
  manualLink?: { inviteId: string; url: string } | null;
  /** Polite live-region text for the outcome of a copy ("Link copied", "Copy failed..."). */
  announcement?: string;
}

export function InvitesHistoryTable({
  invites,
  onCopyLink,
  onDelete,
  viewOnlyGameIds = [],
  copiedId = null,
  manualLink = null,
  announcement = '',
}: InvitesHistoryTableProps) {
  // The fallback field takes focus as it appears so a keyboard or screen-reader user lands on the
  // link they now have to copy by hand.
  const manualInputRef = useRef<HTMLInputElement>(null);
  const manualUrl = manualLink?.url;
  useEffect(() => {
    if (manualUrl) manualInputRef.current?.focus();
  }, [manualUrl]);

  return (
    <div data-tour="invite-history" className="space-y-4 pt-4 border-t border-zinc-800">
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-lg font-bold text-white">Issued Player Invitations</h2>
        <span className="text-xs text-zinc-500">{invites.length} Total Invites</span>
      </div>

      {/* Capped height so a long list scrolls inside the table instead of stretching the page. */}
      <div className="max-h-96 overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full min-w-[36rem] text-left text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="text-zinc-500 border-b border-zinc-800 bg-zinc-950">
              <th className="py-3 px-4 font-semibold">Intended Student</th>
              <th className="py-3 px-4 font-semibold">Game</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold">Created</th>
              <th className="py-3 px-4 font-semibold">Expires</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {invites.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-zinc-500">
                  No invites generated yet. Use the generator above to create one.
                </td>
              </tr>
            ) : (
              invites.map((inv) => (
                <tr key={inv.id} className="hover:bg-zinc-800/20">
                  <td className="py-3 px-4 font-medium text-white">
                    {inv.intendedFirstName} {inv.intendedLastName}
                  </td>
                  <td className="py-3 px-4 text-zinc-300">{inv.gameName}</td>
                  <td className="py-3 px-4">
                    {inv.status === 'accepted' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                        Accepted
                      </span>
                    ) : inv.status === 'submitted' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20">
                        Submitted
                      </span>
                    ) : inv.status === 'rejected' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-400/10 text-rose-400 border border-rose-400/20">
                        Rejected
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-zinc-400">
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-zinc-400">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {inv.status === 'pending' && !viewOnlyGameIds.includes(inv.gameId ?? '') ? (
                      <div className="inline-flex items-center justify-end gap-1">
                        <Button
                          onPress={() => onCopyLink(inv)}
                          aria-label={`Copy a new invite link for ${inv.intendedFirstName} ${inv.intendedLastName}`}
                          className={`inline-flex min-h-[44px] items-center gap-1.5 px-2.5 rounded transition-colors cursor-pointer ${
                            copiedId === inv.id
                              ? 'text-emerald-400 bg-emerald-400/10'
                              : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                          }`}
                        >
                          <HiOutlineClipboardDocument className="w-4 h-4" aria-hidden="true" />
                          <span className="font-semibold">{copiedId === inv.id ? 'Copied' : 'Copy link'}</span>
                        </Button>
                        <Button
                          onPress={() => onDelete(inv)}
                          aria-label={`Delete invite for ${inv.intendedFirstName} ${inv.intendedLastName}`}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-zinc-400 transition-colors cursor-pointer hover:bg-rose-500/10 hover:text-rose-300"
                        >
                          <HiOutlineTrash className="w-4 h-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-zinc-600">
                        <span aria-hidden="true">&mdash;</span>
                        <span className="sr-only">No actions available</span>
                      </span>
                    )}
                    {manualLink?.inviteId === inv.id && (
                      <input
                        ref={manualInputRef}
                        readOnly
                        value={manualLink.url}
                        aria-label="New invite link, copy manually"
                        onFocus={(e) => e.currentTarget.select()}
                        className="mt-2 block w-full min-w-[14rem] rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
                      />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
