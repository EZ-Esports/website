'use client';

import { useState, useTransition } from 'react';
import { Button } from 'react-aria-components';
import {
  HiOutlineUserPlus,
  HiOutlineClipboardDocument,
  HiOutlineCheck,
  HiOutlineExclamationTriangle,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import {
  createPlayerInvite,
  type SchoolInviteItem,
} from '@/app/lib/onboarding/portal-actions';
import type { GameItem } from './GameTabs';

interface GenerateInviteCardProps {
  games: GameItem[];
  schoolId: string;
  schoolSlug: string;
  inviteGameId: string;
  setInviteGameId: (id: string) => void;
  onInviteCreated: (invite: SchoolInviteItem) => void;
}

export function GenerateInviteCard({
  games,
  schoolId,
  schoolSlug,
  inviteGameId,
  setInviteGameId,
  onInviteCreated,
}: GenerateInviteCardProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [expiryDays, setExpiryDays] = useState(7);
  const [generatedInvite, setGeneratedInvite] = useState<{
    url: string;
    studentName: string;
    expiresAt: Date;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGenerating, startGenerating] = useTransition();
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      // Clipboard write failed gracefully
    }
  };

  const handleGenerateInvite = () => {
    if (!firstName.trim() || !lastName.trim()) {
      setGenerateError('Please enter student first and last name.');
      return;
    }
    if (!inviteGameId) {
      setGenerateError('Please select a game.');
      return;
    }

    setGenerateError(null);
    startGenerating(async () => {
      try {
        const result = await createPlayerInvite({
          schoolId,
          gameId: inviteGameId,
          intendedFirstName: firstName.trim(),
          intendedLastName: lastName.trim(),
          expiresInDays: expiryDays,
        });

        const fullUrl = window.location.origin + result.inviteUrl;
        setGeneratedInvite({
          url: fullUrl,
          studentName: `${result.intendedFirstName} ${result.intendedLastName}`,
          expiresAt: result.expiresAt,
        });

        const game = games.find((g) => g.id === inviteGameId);
        const newInviteItem: SchoolInviteItem = {
          id: result.inviteId,
          schoolId,
          gameId: inviteGameId,
          intendedFirstName: result.intendedFirstName,
          intendedLastName: result.intendedLastName,
          status: 'pending',
          expiresAt: result.expiresAt,
          submittedAt: null,
          reviewedAt: null,
          rejectionReason: null,
          createdAt: new Date(),
          schoolSlug,
          gameSlug: game?.slug || '',
          gameName: game?.displayName || '',
        };
        onInviteCreated(newInviteItem);

        try {
          await navigator.clipboard.writeText(fullUrl);
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 3000);
        } catch {
          // Clipboard write failed gracefully
        }

        setFirstName('');
        setLastName('');
      } catch (err: any) {
        setGenerateError(err.message || 'Failed to create invite link');
      }
    });
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-xl space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-[#f4cccc]/10 text-[#f4cccc]">
          <HiOutlineUserPlus className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white">Create Player Invite</h2>
          <p className="text-xs text-zinc-400">Generate a secure single-use onboarding URL</p>
        </div>
      </div>

      {generateError && (
        <div className="p-3 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-lg flex items-center gap-2">
          <HiOutlineExclamationTriangle className="w-4 h-4 shrink-0" />
          <span>{generateError}</span>
        </div>
      )}

      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Student First Name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Alex"
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Student Last Name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Chen"
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">Game</label>
          <select
            value={inviteGameId}
            onChange={(e) => setInviteGameId(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
          >
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.displayName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            Link Expiration
          </label>
          <select
            value={expiryDays}
            onChange={(e) => setExpiryDays(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
          >
            <option value={3}>3 Days</option>
            <option value={7}>7 Days (Standard)</option>
            <option value={14}>14 Days</option>
          </select>
        </div>

        <Button
          onPress={handleGenerateInvite}
          isDisabled={isGenerating}
          className="w-full py-2.5 px-4 bg-[#f4cccc] hover:bg-[#e6b8b8] text-zinc-950 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isGenerating ? (
            <span>Generating Invite...</span>
          ) : (
            <>
              <HiOutlineSparkles className="w-4 h-4" />
              <span>Generate One-Time Invite</span>
            </>
          )}
        </Button>
      </div>

      {/* Generated Link Box */}
      {generatedInvite && (
        <div className="p-4 rounded-xl bg-zinc-950 border border-[#f4cccc]/30 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#f4cccc]">
              Invite for {generatedInvite.studentName}
            </span>
            <span className="text-zinc-500">
              Expires {new Date(generatedInvite.expiresAt).toLocaleDateString()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={generatedInvite.url}
              className="flex-1 px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded text-zinc-300 font-mono select-all focus:outline-none"
            />
            <Button
              onPress={() => handleCopyLink(generatedInvite.url)}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white rounded transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <HiOutlineCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <HiOutlineClipboardDocument className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Send this link to the student. They will complete Discord OAuth and Riot verification before appearing in your approval queue.
          </p>
        </div>
      )}
    </div>
  );
}
