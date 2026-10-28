'use client';

import { FiCheck, FiClock, FiExternalLink } from 'react-icons/fi';
import { SiDiscord } from 'react-icons/si';
import { ContentFlagNotice } from '../ContentFlagNotice';
import type { ContentFlagControls } from '../../types';

interface DiscordStepProps {
  /** Server-verified identity from Discord OAuth. */
  verified: { username: string; inGuild: boolean } | null;
  connecting: boolean;
  onConnect: () => void;
  /** Offensive-content warnings and overrides for this step's fields. */
  contentFlags?: ContentFlagControls;
}

export function DiscordStep({
  verified,
  connecting,
  onConnect,
  contentFlags,
}: DiscordStepProps) {
  // aria-disabled keeps the button focusable (native `disabled` would drop keyboard focus), so the
  // handler itself ignores presses while a connection is already opening.
  const handleConnect = () => {
    if (!connecting) onConnect();
  };

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

        {/* Always mounted so a screen reader announces the change when the banner appears. */}
        <div role="status" aria-live="polite">
          {verified?.inGuild && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
              <FiCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-xs sm:text-sm text-foreground">
                <p>
                  Connected as <strong>@{verified.username}</strong>, in the EZ Esports server.
                </p>
                <button
                  type="button"
                  onClick={handleConnect}
                  aria-disabled={connecting}
                  className="mt-1 min-h-[44px] text-xs text-accent underline aria-disabled:opacity-50"
                >
                  Use a different Discord account (opens a new tab)
                </button>
              </div>
            </div>
          )}
        </div>
        {verified?.inGuild && <ContentFlagNotice field="discordUsername" controls={contentFlags} />}

        {!verified?.inGuild && (
          <div className="space-y-3">
            <p className="text-xs text-foreground-muted leading-relaxed">
              Sign in with Discord and we will add you to the official server automatically. We only
              read your Discord username and ID; we never see your password or messages. Discord opens in
              a new tab: when it says you are connected, come back to this tab. Everything you have
              entered here stays as it is.
            </p>
            {connecting && (
              <p role="status" className="text-xs text-foreground-muted leading-relaxed">
                Waiting for Discord in the other tab. If you do not see it, check for a blocked pop-up.
              </p>
            )}
            <button
              type="button"
              onClick={handleConnect}
              aria-disabled={connecting}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#5865F2] text-white text-sm font-semibold hover:bg-[#4752c4] transition-colors aria-disabled:opacity-60"
            >
              {connecting ? (
                <>
                  <FiClock className="w-4 h-4 animate-spin" /> Waiting for Discord...
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
