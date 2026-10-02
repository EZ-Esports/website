'use client';

import { Button } from 'react-aria-components';
import { HiOutlineClipboardDocument } from 'react-icons/hi2';
import type { SchoolInviteItem } from '@/app/lib/onboarding/portal-actions';

interface InvitesHistoryTableProps {
  invites: SchoolInviteItem[];
  onCopyLink: (url: string) => void;
}

export function InvitesHistoryTable({
  invites,
  onCopyLink,
}: InvitesHistoryTableProps) {
  return (
    <div className="space-y-4 pt-4 border-t border-zinc-800">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Issued Player Invitations</h2>
        <span className="text-xs text-zinc-500">{invites.length} Total Invites</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-zinc-500 border-b border-zinc-800 bg-zinc-950/60">
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
                    <Button
                      onPress={() => {
                        const url = `${window.location.origin}/join/${inv.schoolSlug}/${inv.gameSlug}`;
                        onCopyLink(url);
                      }}
                      aria-label="Copy Base Join URL"
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <HiOutlineClipboardDocument className="w-4 h-4" />
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
