'use client';

import { RequiredMark } from '../RequiredMark';
import {
  DEFAULT_MANAGER_SEASON,
  GRADUATION_YEAR_OPTIONS,
  MANAGER_SEASON_OPTIONS,
} from '../../types';
import { ContentFlagNotice, contentFieldProps } from '../ContentFlagNotice';
import type { ContentFlagControls } from '../../types';

interface AccountInfoStepProps {
  legalFirstName: string;
  setLegalFirstName: (val: string) => void;
  legalLastName: string;
  setLegalLastName: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  password?: string;
  setPassword?: (val: string) => void;
  graduationYear: number;
  setGraduationYear: (val: number) => void;
  academicYear?: string;
  setAcademicYear?: (val: string) => void;
  /** Manager only: "I also play in this league" and the games they play. */
  alsoPlays?: boolean;
  setAlsoPlays?: (val: boolean) => void;
  playableGames?: Array<{ id: string; displayName: string }>;
  playGameIds?: string[];
  setPlayGameIds?: (val: string[]) => void;
  isManager: boolean;
  /** Offensive-content warnings and overrides for this step's fields. */
  contentFlags?: ContentFlagControls;
}

export function AccountInfoStep({
  legalFirstName,
  setLegalFirstName,
  legalLastName,
  setLegalLastName,
  email,
  setEmail,
  password,
  setPassword,
  graduationYear,
  setGraduationYear,
  academicYear,
  setAcademicYear,
  alsoPlays = false,
  setAlsoPlays,
  playableGames = [],
  playGameIds = [],
  setPlayGameIds,
  isManager,
  contentFlags,
}: AccountInfoStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">
          Step 1: Student Information
        </h2>
        <p className="text-xs sm:text-sm text-foreground-muted mt-1">
          Verify your legal name and student email address for tournament roster eligibility.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="account-legal-first-name"
            className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5"
          >
            Legal First Name<RequiredMark />
          </label>
          <input
            id="account-legal-first-name"
            {...contentFieldProps('legalFirstName', contentFlags)}
            type="text"
            value={legalFirstName}
            onChange={(e) => setLegalFirstName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g. Alex"
            required
          />
          <ContentFlagNotice field="legalFirstName" controls={contentFlags} />
        </div>

        <div>
          <label
            htmlFor="account-legal-last-name"
            className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5"
          >
            Legal Last Name<RequiredMark />
          </label>
          <input
            id="account-legal-last-name"
            {...contentFieldProps('legalLastName', contentFlags)}
            type="text"
            value={legalLastName}
            onChange={(e) => setLegalLastName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g. Chen"
            required
          />
          <ContentFlagNotice field="legalLastName" controls={contentFlags} />
        </div>
      </div>

      <div>
        <label
          htmlFor="account-email"
          className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5"
        >
          {isManager ? <>Manager Email Address<RequiredMark /></> : <>Student Email Address<RequiredMark /></>}
        </label>
        <input
          id="account-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder={
            isManager
              ? 'e.g. coach@school.edu'
              : 'e.g. achen@nycstudents.net or student@gmail.com'
          }
          required
        />
        <p className="text-xs text-foreground-muted mt-1">
          {isManager
            ? 'Used to sign in to your School Manager Portal account and receive league updates.'
            : 'Used for tournament notifications, official roster verification, and bracket updates.'}
        </p>
      </div>

      {isManager && setPassword && (
        <div>
          <label
            htmlFor="account-password"
            className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5"
          >
            Create Portal Account Password<RequiredMark />
          </label>
          <input
            id="account-password"
            type="password"
            value={password || ''}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            data-1p-ignore="true"
            data-lpignore="true"
            required
          />
          <p className="text-xs text-foreground-muted mt-1">
            Required to sign in to the School Manager Portal at /portal/login.
          </p>
        </div>
      )}

      <div>
        <label
          htmlFor="account-graduation-year"
          className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5"
        >
          Anticipated High School Graduation Year<RequiredMark />
        </label>
        <select
          id="account-graduation-year"
          value={graduationYear || ''}
          onChange={(e) => setGraduationYear(Number(e.target.value))}
          className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="" disabled>
            Choose an option
          </option>
          {GRADUATION_YEAR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {isManager && setAcademicYear && (
        <div>
          <label
            htmlFor="account-academic-year"
            className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5"
          >
            Season Affiliation<RequiredMark />
          </label>
          <select
            id="account-academic-year"
            value={academicYear ?? DEFAULT_MANAGER_SEASON}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {MANAGER_SEASON_OPTIONS.map((season) => (
              <option key={season} value={season}>
                {season}
                {season === DEFAULT_MANAGER_SEASON ? ' (Current Season)' : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-foreground-muted mt-1">
            The season you are applying to manage your school&apos;s teams for.
          </p>
        </div>
      )}

      {isManager && setAlsoPlays && setPlayGameIds && (
        <fieldset className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            Will you also be playing?
          </legend>
          <label className="flex min-h-[44px] items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={alsoPlays}
              onChange={(e) => setAlsoPlays(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent accent-accent"
            />
            <span className="text-sm text-foreground">
              I also play in this league
              <span className="block text-xs text-foreground-muted mt-0.5">
                You will be registered as a player in this same sign-up, with the same Discord account and
                details. Your player application goes to the normal review queue.
              </span>
            </span>
          </label>

          {alsoPlays && (
            <div role="group" aria-label="Games you play" className="space-y-1 pl-7">
              <p className="text-xs font-semibold text-foreground-muted">
                Which games do you play?<RequiredMark />
              </p>
              {playableGames.map((game) => (
                <label key={game.id} className="flex min-h-[44px] items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={playGameIds.includes(game.id)}
                    onChange={(e) =>
                      setPlayGameIds(
                        e.target.checked
                          ? [...playGameIds, game.id]
                          : playGameIds.filter((id) => id !== game.id)
                      )
                    }
                    className="h-4 w-4 rounded border-border text-accent focus:ring-accent accent-accent"
                  />
                  <span className="text-sm text-foreground">{game.displayName}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}
