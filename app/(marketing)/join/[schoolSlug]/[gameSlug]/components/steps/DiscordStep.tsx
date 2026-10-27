'use client';

import { FiCheck, FiClock, FiExternalLink } from 'react-icons/fi';
import { SiDiscord } from 'react-icons/si';

interface DiscordStepProps {
  /** Server-verified identity from Discord OAuth. */
  verified: { username: string; inGuild: boolean } | null;
  connecting: boolean;
  onConnect: () => void;
}

export function DiscordStep({
  verified,
  connecting,
  onConnect,
}: DiscordStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">
          Step 2: Discord Connection (Comms & Voice Gate)
        </h2>
        <p className="text-xs sm:text-sm text-foreground-muted mt-1">
          EZ Esports requires every player and school manager to be in the official Discord server for match voice communications, referee pings, and tournament operations.
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

        {verified?.inGuild ? (
          <div className="flex items-start gap-3 p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
            <FiCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-foreground">
              <p>
                Connected as <strong>@{verified.username}</strong>, in the EZ Esports server.
              </p>
              <button
                type="button"
                onClick={onConnect}
                disabled={connecting}
                className="mt-1 text-xs text-accent underline disabled:opacity-50"
              >
                Use a different Discord account
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-foreground-muted leading-relaxed">
              Sign in with Discord and we will add you to the official server automatically. We only
              read your Discord username and ID; we never see your password or messages.
            </p>
            <button
              type="button"
              onClick={onConnect}
              disabled={connecting}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#5865F2] text-white text-sm font-semibold hover:bg-[#4752c4] transition-colors disabled:opacity-60"
            >
              {connecting ? (
                <>
                  <FiClock className="w-4 h-4 animate-spin" /> Opening Discord...
                </>
              ) : (
                <>
                  <SiDiscord className="w-4 h-4" /> Connect Discord
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
