'use client';

import { useEffect, useRef } from 'react';
import { Button as AriaButton, FileTrigger } from 'react-aria-components';
import { SCHOOL_EMAIL_DOMAIN } from '@/app/lib/onboarding/school-email';
import { STUDENT_ID_ACCEPT, STUDENT_ID_MAX_BYTES, formatMegabytes } from '@/app/lib/onboarding/student-id';
import { RequiredMark } from '../RequiredMark';
import {
  DEFAULT_MANAGER_SEASON,
  GRADUATION_YEAR_OPTIONS,
  MANAGER_SEASON_OPTIONS,
} from '../../types';
import { ContentFlagNotice, contentFieldProps } from '../ContentFlagNotice';
import type { ContentFlagControls } from '../../types';
import { capitalizeNameWords } from '@/app/lib/onboarding/name-case';

interface AccountInfoStepProps {
  legalFirstName: string;
  setLegalFirstName: (val: string) => void;
  legalLastName: string;
  setLegalLastName: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  /** nycstudents.net address, required for players and managers. */
  schoolEmail: string;
  setSchoolEmail: (val: string) => void;
  /** Student ID photo: uploaded on selection and held by the server against this invite. */
  studentIdUploaded: boolean;
  studentIdUploading: boolean;
  studentIdError: string | null;
  studentIdLabel: string | null;
  onStudentIdChosen: (file: File | null) => void;
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
  /** Increments each time the person tries to continue with no game chosen. */
  playGamesErrorTick?: number;
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
  schoolEmail,
  setSchoolEmail,
  studentIdUploaded,
  studentIdUploading,
  studentIdError,
  studentIdLabel,
  onStudentIdChosen,
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
  playGamesErrorTick = 0,
  setPlayGameIds,
  isManager,
  contentFlags,
}: AccountInfoStepProps) {
  const firstGameRef = useRef<HTMLInputElement>(null);
  const gamesInvalid = playGamesErrorTick > 0 && alsoPlays && playGameIds.length === 0;
  // Each failed attempt moves focus to the first game so keyboard and screen reader users land on the problem.
  useEffect(() => {
    if (playGamesErrorTick > 0) firstGameRef.current?.focus();
  }, [playGamesErrorTick]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">
          Step 1: Student Information
        </h2>
        <p className="text-xs sm:text-sm text-foreground-muted mt-1">
          Verify your legal name, your emails and your student ID for tournament roster eligibility.
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
            onBlur={(e) => setLegalFirstName(capitalizeNameWords(e.target.value))}
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
            onBlur={(e) => setLegalLastName(capitalizeNameWords(e.target.value))}
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
          Personal Email Address<RequiredMark />
        </label>
        <input
          id="account-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder={
            isManager
              ? 'e.g. coach@gmail.com'
              : 'e.g. student@gmail.com'
          }
          required
        />
        <p className="text-xs text-foreground-muted mt-1">
          {isManager
            ? 'Used to sign in to your School Manager Portal account and receive league updates.'
            : 'Used for tournament notifications and bracket updates. This must be different from your school email.'}
        </p>
      </div>

      <div>
        <label
          htmlFor="account-school-email"
          className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5"
        >
          School Email (must end in @{SCHOOL_EMAIL_DOMAIN})<RequiredMark />
        </label>
        <input
          id="account-school-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={schoolEmail}
          onChange={(e) => setSchoolEmail(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder={`e.g. achen@${SCHOOL_EMAIL_DOMAIN}`}
          aria-describedby="account-school-email-hint"
          required
        />
        <p id="account-school-email-hint" className="text-xs text-foreground-muted mt-1">
          Your NYC Public Schools student address. Staff match it against your student ID.
        </p>
      </div>

      <div>
        <span
          id="student-id-label"
          className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5"
        >
          Photo of Your Student ID<RequiredMark />
        </span>
        <p id="student-id-hint" className="text-xs text-foreground-muted mb-2">
          A clear photo of your school ID card (JPEG, PNG or WebP, up to {formatMegabytes(STUDENT_ID_MAX_BYTES)}).
          It is stored privately and only reviewed by EZ Esports staff.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <FileTrigger
            acceptedFileTypes={STUDENT_ID_ACCEPT.split(',')}
            onSelect={(files) => onStudentIdChosen(files && files.length > 0 ? files[0] : null)}
          >
            <AriaButton
              id="student-id"
              isDisabled={studentIdUploading}
              aria-labelledby="student-id-label student-id"
              aria-describedby={['student-id-hint', 'student-id-status', studentIdError ? 'student-id-error' : null]
                .filter(Boolean)
                .join(' ')}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-bold text-foreground cursor-pointer outline-none data-[hovered]:border-accent/50 data-[focus-visible]:ring-2 data-[focus-visible]:ring-accent data-[disabled]:opacity-60"
            >
              {studentIdUploading ? 'Uploading...' : studentIdUploaded ? 'Replace photo' : 'Choose photo'}
            </AriaButton>
          </FileTrigger>
          <span
            id="student-id-status"
            aria-live="polite"
            className={`min-w-0 break-all text-sm ${studentIdUploaded ? 'font-semibold text-foreground' : 'text-foreground-muted'}`}
          >
            {studentIdUploaded ? `Uploaded${studentIdLabel ? `: ${studentIdLabel}` : ''}` : 'No photo uploaded yet'}
          </span>
        </div>
        {studentIdError && (
          <p id="student-id-error" role="alert" className="text-xs text-rose-300 mt-1.5">
            {studentIdError}
          </p>
        )}
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
            <div
              role="group"
              aria-label="Games you play"
              aria-describedby={gamesInvalid ? 'play-games-error' : undefined}
              className="space-y-1 pl-7"
            >
              <p className="text-xs font-semibold text-foreground-muted">
                Which games do you play?<RequiredMark />
              </p>
              {playableGames.length === 0 && (
                <p className="text-xs text-foreground-muted">
                  No games are available for your invite yet. Untick the box above or contact EZ Esports.
                </p>
              )}
              {playableGames.map((game, index) => (
                <label key={game.id} className="flex min-h-[44px] items-center gap-3 cursor-pointer">
                  <input
                    ref={index === 0 ? firstGameRef : undefined}
                    aria-invalid={gamesInvalid || undefined}
                    aria-describedby={gamesInvalid ? 'play-games-error' : undefined}
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
              {gamesInvalid && (
                <p id="play-games-error" role="alert" className="text-xs text-rose-300">
                  Choose at least one game you will play.
                </p>
              )}
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}
