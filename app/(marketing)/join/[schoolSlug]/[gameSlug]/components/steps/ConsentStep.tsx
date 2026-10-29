'use client';

import {
  CONSENT_TEXT,
  TERMS_OF_SERVICE_PATH,
  formatConsentIntro,
} from '@/app/lib/onboarding/consent';
import { capitalizeNameWords } from '@/app/lib/onboarding/name-case';
import { RequiredMark } from '../RequiredMark';
import { ContentFlagNotice, contentFieldProps } from '../ContentFlagNotice';
import type { ContentFlagControls } from '../../types';

interface ConsentStepProps {
  /** Age computed from the date of birth entered in Step 4; null if none was entered. */
  age: number | null;
  isMinor: boolean;
  tosAcknowledged: boolean;
  setTosAcknowledged: (val: boolean) => void;
  participantLegalName: string;
  setParticipantLegalName: (val: string) => void;
  guardianFullName: string;
  setGuardianFullName: (val: string) => void;
  guardianRelationship: string;
  setGuardianRelationship: (val: string) => void;
  guardianEmail: string;
  setGuardianEmail: (val: string) => void;
  guardianSignature: string;
  setGuardianSignature: (val: string) => void;
  /** Offensive-content warnings and overrides for this step's fields. */
  contentFlags?: ContentFlagControls;
}

const inputClass =
  'w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-surface-raised border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent';
const labelClass = 'block text-xs font-semibold text-foreground-secondary mb-1.5';
const sectionHeadingClass = 'text-sm font-bold text-foreground';

/** Display-only date; the stored signing timestamp is stamped by the server. */
function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ConsentStep({
  age,
  isMinor,
  tosAcknowledged,
  setTosAcknowledged,
  participantLegalName,
  setParticipantLegalName,
  guardianFullName,
  setGuardianFullName,
  guardianRelationship,
  setGuardianRelationship,
  guardianEmail,
  setGuardianEmail,
  guardianSignature,
  setGuardianSignature,
  contentFlags,
}: ConsentStepProps) {
  const termsLink = (
    <a
      href={TERMS_OF_SERVICE_PATH}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline underline-offset-2 hover:text-accent/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
    >
      EZ Esports Terms of Service
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">
          Step 5: {isMinor ? CONSENT_TEXT.guardianHeading : 'Terms of Service'}
        </h2>
        {isMinor && age !== null && (
          <p className="text-xs sm:text-sm text-foreground-secondary mt-1 leading-relaxed">
            {formatConsentIntro(age)}
          </p>
        )}
      </div>

      <p className="text-xs sm:text-sm text-foreground-secondary">
        {CONSENT_TEXT.termsLinkLead} {termsLink}
      </p>

      {/* 1. Terms of Service Acknowledgment (everyone) */}
      <section className="space-y-3" aria-labelledby="consent-tos-heading">
        <h3 id="consent-tos-heading" className={sectionHeadingClass}>
          {CONSENT_TEXT.tosHeading}
        </h3>
        <label className="flex items-start gap-3 cursor-pointer p-3.5 rounded-xl bg-surface-raised border border-border hover:border-accent/40 transition-colors">
          <input
            type="checkbox"
            checked={tosAcknowledged}
            onChange={(e) => setTosAcknowledged(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent accent-accent"
            required
          />
          <span className="text-xs text-foreground leading-relaxed">
            {CONSENT_TEXT.tosCheckbox}
            <RequiredMark />
          </span>
        </label>
      </section>

      {isMinor && (
        <>
          {/* 2. Participant Information */}
          <section
            className="space-y-3 pt-4 border-t border-border"
            aria-labelledby="consent-participant-heading"
          >
            <h3 id="consent-participant-heading" className={sectionHeadingClass}>
              {CONSENT_TEXT.participantHeading}
            </h3>
            <div>
              <label htmlFor="consent-participant-name" className={labelClass}>
                {CONSENT_TEXT.participantNameLabel}
                <RequiredMark />
              </label>
              <input
                id="consent-participant-name"
                {...contentFieldProps('participantLegalName', contentFlags)}
                type="text"
                autoComplete="off"
                value={participantLegalName}
                onChange={(e) => setParticipantLegalName(e.target.value)}
                onBlur={(e) => {
                  const capitalized = capitalizeNameWords(e.target.value);
                  if (capitalized !== e.target.value) setParticipantLegalName(capitalized);
                }}
                className={inputClass}
                required
              />
              <ContentFlagNotice field="participantLegalName" controls={contentFlags} />
            </div>
          </section>

          {/* 3. Parent or Legal Guardian Authorization */}
          <section
            className="space-y-3 pt-4 border-t border-border"
            aria-labelledby="consent-authorization-heading"
          >
            <h3 id="consent-authorization-heading" className={sectionHeadingClass}>
              {CONSENT_TEXT.authorizationHeading}
            </h3>
            <p className="text-xs text-foreground-secondary">{CONSENT_TEXT.authorizationLead}</p>
            <ul className="list-disc pl-5 space-y-2 text-xs text-foreground leading-relaxed">
              {CONSENT_TEXT.authorizationItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          {/* 4. Parent or Legal Guardian Information */}
          <section
            className="space-y-3 pt-4 border-t border-border"
            aria-labelledby="consent-guardian-heading"
          >
            <h3 id="consent-guardian-heading" className={sectionHeadingClass}>
              {CONSENT_TEXT.guardianInfoHeading}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="consent-guardian-name" className={labelClass}>
                  {CONSENT_TEXT.guardianNameLabel}
                  <RequiredMark />
                </label>
                <input
                  id="consent-guardian-name"
                  {...contentFieldProps('guardianFullName', contentFlags)}
                  type="text"
                  autoComplete="off"
                  value={guardianFullName}
                  onChange={(e) => setGuardianFullName(e.target.value)}
                  className={inputClass}
                  required
                />
                <ContentFlagNotice field="guardianFullName" controls={contentFlags} />
              </div>
              <div>
                <label htmlFor="consent-guardian-relationship" className={labelClass}>
                  {CONSENT_TEXT.guardianRelationshipLabel}
                  <RequiredMark />
                </label>
                <input
                  id="consent-guardian-relationship"
                  {...contentFieldProps('guardianRelationship', contentFlags)}
                  type="text"
                  autoComplete="off"
                  value={guardianRelationship}
                  onChange={(e) => setGuardianRelationship(e.target.value)}
                  className={inputClass}
                  required
                />
                <ContentFlagNotice field="guardianRelationship" controls={contentFlags} />
              </div>
            </div>
            <div>
              <label htmlFor="consent-guardian-email" className={labelClass}>
                {CONSENT_TEXT.guardianEmailLabel}
                <RequiredMark />
              </label>
              <input
                id="consent-guardian-email"
                type="email"
                autoComplete="off"
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </section>

          {/* 5. Electronic Signature */}
          <section
            className="space-y-3 pt-4 border-t border-border"
            aria-labelledby="consent-signature-heading"
          >
            <h3 id="consent-signature-heading" className={sectionHeadingClass}>
              {CONSENT_TEXT.signatureHeading}
            </h3>
            <p className="text-xs text-foreground-secondary leading-relaxed">
              {CONSENT_TEXT.signatureIntro}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="consent-guardian-signature" className={labelClass}>
                  {CONSENT_TEXT.signatureLabel}
                  <RequiredMark />
                </label>
                <input
                  id="consent-guardian-signature"
                  {...contentFieldProps('guardianSignature', contentFlags)}
                  type="text"
                  autoComplete="off"
                  value={guardianSignature}
                  onChange={(e) => setGuardianSignature(e.target.value)}
                  className={inputClass}
                  required
                />
                <ContentFlagNotice field="guardianSignature" controls={contentFlags} />
              </div>
              <div>
                <label htmlFor="consent-date" className={labelClass}>
                  {CONSENT_TEXT.dateLabel}
                </label>
                <input
                  id="consent-date"
                  type="text"
                  value={todayLabel()}
                  readOnly
                  className={`${inputClass} opacity-80`}
                />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
