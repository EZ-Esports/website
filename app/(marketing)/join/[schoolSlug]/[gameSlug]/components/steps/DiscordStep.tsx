'use client';

import { FiCheck, FiExternalLink } from 'react-icons/fi';
import { SiDiscord } from 'react-icons/si';

interface DiscordStepProps {
  discordUsername: string;
  setDiscordUsername: (val: string) => void;
  discordJoinedConfirmed: boolean;
  setDiscordJoinedConfirmed: (val: boolean) => void;
}

export function DiscordStep({
  discordUsername,
  setDiscordUsername,
  discordJoinedConfirmed,
  setDiscordJoinedConfirmed,
}: DiscordStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">
          Step 2: Discord Connection (Comms & Voice Gate)
        </h2>
        <p className="text-xs sm:text-sm text-foreground-muted mt-1">
          EZ Esports requires all active competitors to be in the official Discord server for match voice communications, referee pings, and tournament operations.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-surface border border-border space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#5865F2]/20 text-[#5865F2] flex items-center justify-center text-xl shrink-0">
            <SiDiscord />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Official EZ Esports Discord
            </h3>
            <p className="text-xs text-foreground-muted">
              Server Invite:{' '}
              <a
                href="https://discord.gg/ezesports"
                target="_blank"
                rel="noreferrer"
                className="text-accent underline inline-flex items-center gap-1"
              >
                discord.gg/ezesports <FiExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">
            Your Discord Handle / Username *
          </label>
          <input
            type="text"
            value={discordUsername}
            onChange={(e) => setDiscordUsername(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g. @alexchen or alex#1234"
            required
          />
        </div>

        <label className="flex items-start gap-3 p-3.5 rounded-lg border border-border bg-surface-elevated/40 cursor-pointer">
          <input
            type="checkbox"
            checked={discordJoinedConfirmed}
            onChange={(e) => setDiscordJoinedConfirmed(e.target.checked)}
            className="mt-0.5 rounded border-border text-accent focus:ring-accent"
          />
          <span className="text-xs text-foreground-muted leading-relaxed">
            I confirm that I have joined the official EZ Esports Discord server (
            <a
              href="https://discord.gg/ezesports"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline inline-flex items-center gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              discord.gg/ezesports <FiExternalLink className="w-2.5 h-2.5" />
            </a>
            ) with this account.
          </span>
        </label>

        {discordUsername.trim() && discordJoinedConfirmed && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <FiCheck className="w-4 h-4 shrink-0" />
            <span>
              Linked: <strong>{discordUsername}</strong> will be registered on the EZ Esports Discord roster
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
