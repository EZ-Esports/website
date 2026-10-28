'use client';

import { useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import { HiOutlineCheck, HiOutlineClipboardDocument } from 'react-icons/hi2';
import type { SchoolInviteItem } from '@/app/lib/onboarding/portal-actions';

interface InvitesHistoryTableProps {
  invites: SchoolInviteItem[];
  onCopyLink: (url: string) => void;
}

export function InvitesHistoryTable({
  invites,
  onCopyLink,
}: InvitesHistoryTableProps) {
  // The invite whose link was just copied; the button confirms it for a moment.
  const [copiedId, setCopiedId] = useState<string | null>(null);
  useEffect(() => {
    if (!copiedId) return;
    const timer = setTimeout(() => setCopiedId(null), 2000);
    return () => clearTimeout(timer);
  }, [copiedId]);

  return (
    <div data-tour="invite-history" className="space-y-4 pt-4 border-t border-zinc-800">
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
              <th className="py-3 px-4 font-semibold text-right">Invite</th>
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
                    <Button
                      onPress={() => {
                        const url = `${window.location.origin}/join/${inv.schoolSlug}/${inv.gameSlug}`;
                        onCopyLink(url);
                        setCopiedId(inv.id);
                      }}
                      aria-label={copiedId === inv.id ? 'Join URL copied' : 'Copy Base Join URL'}
                      className={`inline-flex items-center gap-1.5 p-2.5 -m-1 rounded transition-colors cursor-pointer ${
                        copiedId === inv.id
                          ? 'text-emerald-400 bg-emerald-400/10'
                          : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                      }`}
                    >
                      {copiedId === inv.id ? (
                        <>
                          <HiOutlineCheck className="w-4 h-4" aria-hidden="true" />
                          <span className="font-semibold">Copied</span>
                        </>
                      ) : (
                        <HiOutlineClipboardDocument className="w-4 h-4" aria-hidden="true" />
                      )}
                    </Button>
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
