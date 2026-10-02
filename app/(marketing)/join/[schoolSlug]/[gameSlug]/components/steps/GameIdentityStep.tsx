'use client';

import { FiCheck, FiExternalLink } from 'react-icons/fi';

interface GameIdentityStepProps {
  riotId: string;
  setRiotId: (val: string) => void;
  ignConfirmed: boolean;
  setIgnConfirmed: (val: boolean) => void;
  isRiotIdValid: boolean;
  trackerUrl: string | null;
  isManager: boolean;
  gameName: string;
}

export function GameIdentityStep({
  riotId,
  setRiotId,
  ignConfirmed,
  setIgnConfirmed,
  isRiotIdValid,
  trackerUrl,
  isManager,
  gameName,
}: GameIdentityStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">
          Step 3: Riot Games Identity
        </h2>
        <p className="text-xs sm:text-sm text-foreground-muted mt-1">
          {isManager
            ? 'Link your Riot Games ID for tournament operations, custom match hosting, and referee verification.'
            : `Link your active Riot ID for ${gameName}. This identifier is used for lobby invites and automatic comp ops stats.`}
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">
          Riot ID (GameName#TagLine) *
        </label>
        <input
          type="text"
          value={riotId}
          onChange={(e) => setRiotId(e.target.value)}
          className={`w-full px-3.5 py-2.5 rounded-lg bg-surface border text-foreground text-sm focus:outline-none focus:ring-2 ${
            riotId
              ? isRiotIdValid
                ? 'border-emerald-500/50 focus:ring-emerald-500'
                : 'border-rose-500/50 focus:ring-rose-500'
              : 'border-border focus:ring-accent'
          }`}
          placeholder="e.g. Demon1#LFT1 or Faker#T1"
          required
        />

        <div className="mt-2 text-xs">
          {riotId && isRiotIdValid ? (
            <span className="text-emerald-400 flex items-center gap-1.5">
              <FiCheck className="w-3.5 h-3.5" /> Valid Riot ID format
            </span>
          ) : (
            <span className="text-foreground-muted">
              Format: 3-16 character name + &#39;#&#39; + 3-5 alphanumeric tagline (e.g. Player#NA1)
            </span>
          )}
        </div>
      </div>

      {trackerUrl && (
        <div className="p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between text-xs">
          <div className="truncate mr-2">
            <span className="text-foreground-muted">Comp Ops Stats Tracker: </span>
            <span className="text-accent font-mono truncate">{trackerUrl}</span>
          </div>
          <a
            href={trackerUrl}
            target="_blank"
            rel="noreferrer"
            className="text-foreground-muted hover:text-accent shrink-0 p-1"
            title="Preview tracker.gg profile"
          >
            <FiExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}

      <div className="pt-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={ignConfirmed}
            onChange={(e) => setIgnConfirmed(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent accent-accent"
          />
          <span className="text-xs text-foreground-muted leading-relaxed">
            I confirm this IGN matches my active in-game account. I agree to notify my school coach and league staff before making any Riot ID changes during the season.
          </span>
        </label>
      </div>
    </div>
  );
}
