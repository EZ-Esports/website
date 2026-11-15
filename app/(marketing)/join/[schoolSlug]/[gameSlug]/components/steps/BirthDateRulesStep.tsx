'use client';

import {
  MIN_BIRTH_DATE,
  STUDENT_AGE_RANGE_MESSAGE,
  calculateAge,
  isPlausibleBirthDate,
  isStudentAgeInRange,
} from '@/app/lib/onboarding/consent';
import { RequiredMark } from '../RequiredMark';
import { ROUTES } from '@/app/lib/constants';

interface BirthDateRulesStepProps {
  birthDate: string;
  setBirthDate: (val: string) => void;
  codeOfConductAccepted: boolean;
  setCodeOfConductAccepted: (val: boolean) => void;
  /** Students must be 13-21; managers (school staff) are not age-limited. */
  enforceStudentAge?: boolean;
}

/**
 * Date of birth only decides whether the next step asks for a parent or guardian; it is checked
 * on the server and then discarded, never stored.
 */
export function BirthDateRulesStep({
  birthDate,
  setBirthDate,
  codeOfConductAccepted,
  setCodeOfConductAccepted,
  enforceStudentAge = true,
}: BirthDateRulesStepProps) {
  const parsed = birthDate ? new Date(birthDate) : null;
  const ageOutOfRange =
    enforceStudentAge &&
    parsed !== null &&
    isPlausibleBirthDate(parsed) &&
    !isStudentAgeInRange(calculateAge(parsed));
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Step 4: Date of Birth & Rules</h2>
        <p className="text-xs sm:text-sm text-foreground-muted mt-1">
          We use your date of birth to know whether a parent or guardian needs to authorize your
          participation on the next step. We do not store it.
        </p>
      </div>

      <div className="max-w-xs">
        <label
          htmlFor="onboarding-birthdate"
          className="block text-xs font-semibold text-foreground-muted mb-1.5"
        >
          Date of Birth<RequiredMark />
        </label>
        <input
          id="onboarding-birthdate"
          type="date"
          value={birthDate}
          onChange={(e) => {
            // Native date inputs accept 5-6 digit years while typing; keep it to 4.
            if (/^\d{5,}-/.test(e.target.value)) return;
            setBirthDate(e.target.value);
          }}
          min={MIN_BIRTH_DATE}
          max={new Date().toISOString().slice(0, 10)}
          aria-invalid={ageOutOfRange || undefined}
          aria-describedby={ageOutOfRange ? 'onboarding-birthdate-error' : undefined}
          className="w-full min-h-[44px] px-3.5 py-2 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          required
        />
        {ageOutOfRange && (
          <p id="onboarding-birthdate-error" role="alert" className="mt-1.5 text-xs text-danger-on-tint">
            {STUDENT_AGE_RANGE_MESSAGE}
          </p>
        )}
      </div>

      <div className="pt-4 border-t border-border">
        <label className="flex items-start gap-3 cursor-pointer p-3.5 rounded-xl bg-surface border border-border hover:border-accent/40 transition-colors">
          <input
            type="checkbox"
            checked={codeOfConductAccepted}
            onChange={(e) => setCodeOfConductAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent accent-accent"
            required
          />
          <span className="text-xs text-foreground leading-relaxed">
            <strong>Code of Conduct & Rules Agreement<RequiredMark />:</strong> I have read and agree to abide by the EZ Esports Rulebook, Code of Conduct, and Tournament Regulations. I understand that unsportsmanlike behavior, toxicity, or ringing will result in immediate disqualification.
            I also understand that offensive or inappropriate names, usernames, Riot IDs, or other information I submit are prohibited under{' '}
            <a href={`${ROUTES.rules}#submitted-information`} target="_blank" rel="noreferrer" className="text-accent underline">
              Rule 3.4 of the league rules
            </a>
            , and that EZ Esports may change or reject any entry that breaks them.
          </span>
        </label>
      </div>
    </div>
  );
}
