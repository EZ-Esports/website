'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  FiCheck,
  FiChevronRight,
  FiChevronLeft,
  FiAlertTriangle,
  FiClock,
  FiShield,
  FiExternalLink,
  FiSave,
} from 'react-icons/fi';
import { SiDiscord } from 'react-icons/si';
import { deriveTrackerUrl, RIOT_ID_REGEX } from '@/app/lib/onboarding/adapters/riot-manual';
import {
  saveOnboardingDraft,
  submitPlayerOnboarding,
  type PlayerOnboardingSubmission,
} from '@/app/lib/onboarding/wizard-actions';

export interface InviteData {
  inviteId: string;
  role?: 'player' | 'manager';
  intendedFirstName: string;
  intendedLastName: string;
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  gameId: string | null;
  gameName: string;
  gameSlug: string;
  submissionDraft: Record<string, any> | null;
  expiresAt: Date;
}

interface PlayerOnboardingWizardProps {
  token: string;
  inviteData: InviteData;
}

const CAREER_INTEREST_OPTIONS = [
  'Competitive Esports Player',
  'Game Design & Programming',
  'Streaming & Content Creation',
  'Broadcast & Live Production',
  'Esports Team Management & Coaching',
  'Graphic Design & Marketing',
  'Event Operations & Refereeing',
];

const RACE_ETHNICITY_OPTIONS = [
  'Asian',
  'Black or African American',
  'Hispanic, Latino, or Spanish Origin',
  'White or Caucasian',
  'Native American or Indigenous',
  'Native Hawaiian or Other Pacific Islander',
  'Middle Eastern or North African',
  'Two or More Races',
  'Prefer not to say',
];

export default function PlayerOnboardingWizard({
  token,
  inviteData,
}: PlayerOnboardingWizardProps) {
  const initialDraft = inviteData.submissionDraft || {};

  const [step, setStep] = useState<number>(1);
  const [isPending, startTransition] = useTransition();
  const [saveDraftPending, setSaveDraftPending] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const isManager = inviteData.role === 'manager';

  // Step 1: Account Information
  const [legalFirstName, setLegalFirstName] = useState(
    initialDraft.legalFirstName || inviteData.intendedFirstName || ''
  );
  const [legalLastName, setLegalLastName] = useState(
    initialDraft.legalLastName || inviteData.intendedLastName || ''
  );
  const [email, setEmail] = useState(initialDraft.email || '');
  const [password, setPassword] = useState(initialDraft.password || '');
  const [graduationYear, setGraduationYear] = useState<number>(
    initialDraft.graduationYear ? Number(initialDraft.graduationYear) : 2026
  );

  // Step 2: Discord Connection
  const [discordUsername, setDiscordUsername] = useState(
    initialDraft.discordUsername || ''
  );
  const [discordJoinedConfirmed, setDiscordJoinedConfirmed] = useState<boolean>(
    Boolean(
      initialDraft.discordJoinedConfirmed ??
        initialDraft.discordConnected ??
        (initialDraft.discordUsername ? true : false)
    )
  );

  // Step 3: Riot Games Identity
  const [riotId, setRiotId] = useState(initialDraft.riotId || '');
  const [ignConfirmed, setIgnConfirmed] = useState<boolean>(
    Boolean(initialDraft.ignConfirmed)
  );

  // Step 4: Demographics & Research Survey
  const [birthDate, setBirthDate] = useState(initialDraft.birthDate || '');
  const [gender, setGender] = useState(initialDraft.gender || '');
  const [selectedRaces, setSelectedRaces] = useState<string[]>(
    Array.isArray(initialDraft.race) ? initialDraft.race : []
  );
  const [countryOfBirth, setCountryOfBirth] = useState(
    initialDraft.countryOfBirth || ''
  );
  const [primaryLanguageAtHome, setPrimaryLanguageAtHome] = useState(
    initialDraft.primaryLanguageAtHome || ''
  );
  const [isFreeOrReducedLunch, setIsFreeOrReducedLunch] = useState<
    boolean | undefined
  >(initialDraft.isFreeOrReducedLunch);
  const [isFirstGenCollege, setIsFirstGenCollege] = useState<
    boolean | undefined
  >(initialDraft.isFirstGenCollege);
  const [doePetitionConsent, setDoePetitionConsent] = useState<boolean>(
    Boolean(initialDraft.doePetitionConsent ?? true)
  );

  // Tech & Gaming Survey
  const [ping, setPing] = useState(initialDraft.surveyDetails?.ping || '20-40ms');
  const [hoursPerWeek, setHoursPerWeek] = useState(
    initialDraft.surveyDetails?.hoursPerWeek || '6-10 hrs'
  );
  const [internetReliability, setInternetReliability] = useState(
    initialDraft.surveyDetails?.internetReliability || 'Cable / Broadband (Stable)'
  );
  const [careerInterests, setCareerInterests] = useState<string[]>(
    Array.isArray(initialDraft.surveyDetails?.careerInterests)
      ? initialDraft.surveyDetails.careerInterests
      : []
  );
  const [feedback, setFeedback] = useState(
    initialDraft.surveyDetails?.feedback || ''
  );

  // Rules Acceptance
  const [codeOfConductAccepted, setCodeOfConductAccepted] = useState<boolean>(
    Boolean(initialDraft.codeOfConductAccepted)
  );

  // Real-time validations
  const isRiotIdValid = RIOT_ID_REGEX.test(riotId.trim());
  const trackerUrl = isRiotIdValid
    ? deriveTrackerUrl(inviteData.gameSlug, riotId.trim())
    : null;

  // Build current draft payload
  function buildCurrentPayload() {
    return {
      legalFirstName,
      legalLastName,
      email,
      password: isManager ? password : undefined,
      graduationYear,
      discordUsername,
      discordJoinedConfirmed,
      discordConnected: Boolean(discordUsername && discordJoinedConfirmed),
      riotId,
      ignConfirmed,
      birthDate,
      gender,
      race: selectedRaces,
      countryOfBirth,
      primaryLanguageAtHome,
      isFreeOrReducedLunch,
      isFirstGenCollege,
      doePetitionConsent,
      surveyDetails: {
        ping,
        hoursPerWeek,
        internetReliability,
        careerInterests,
        feedback,
      },
      codeOfConductAccepted,
    };
  }

  // Handle saving draft
  async function handleSaveDraft() {
    setSaveDraftPending(true);
    setSaveStatus(null);
    try {
      const draft = buildCurrentPayload();
      await saveOnboardingDraft({
        token,
        draftData: draft,
      });
      setSaveStatus('Draft saved successfully');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      setSaveStatus(`Failed to save draft: ${err.message || 'Unknown error'}`);
    } finally {
      setSaveDraftPending(false);
    }
  }

  // Step 1 Validation
  function validateStep1(): boolean {
    setErrorMessage(null);
    if (!legalFirstName.trim()) {
      setErrorMessage('Please enter your legal first name.');
      return false;
    }
    if (!legalLastName.trim()) {
      setErrorMessage('Please enter your legal last name.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setErrorMessage(
        isManager
          ? 'Please enter a valid email address.'
          : 'Please enter a valid student email address.'
      );
      return false;
    }
    if (isManager && (!password || password.length < 8)) {
      setErrorMessage(
        'Please enter a password with at least 8 characters to access the School Manager Portal.'
      );
      return false;
    }
    if (!graduationYear || graduationYear < 2024 || graduationYear > 2035) {
      setErrorMessage('Please select a valid expected graduation or academic year.');
      return false;
    }
    return true;
  }

  // Step 2 Validation
  function validateStep2(): boolean {
    setErrorMessage(null);
    if (!discordUsername.trim()) {
      setErrorMessage('Please enter your Discord handle or username.');
      return false;
    }
    if (!discordJoinedConfirmed) {
      setErrorMessage(
        'Please confirm that you have joined the official EZ Esports Discord server.'
      );
      return false;
    }
    return true;
  }

  // Step 3 Validation
  function validateStep3(): boolean {
    setErrorMessage(null);
    if (!riotId.trim()) {
      setErrorMessage('Please enter your Riot ID.');
      return false;
    }
    if (!isRiotIdValid) {
      setErrorMessage(
        'Invalid Riot ID format. Expected Name#Tag (e.g., Demon1#NA1), where name is 3-16 characters and tag is 3-5 alphanumeric characters.'
      );
      return false;
    }
    if (!ignConfirmed) {
      setErrorMessage(
        'You must confirm that this IGN matches your active in-game account.'
      );
      return false;
    }
    return true;
  }

  // Step 4 & Final Submission
  function handleSubmit() {
    setErrorMessage(null);

    if (!birthDate) {
      setErrorMessage('Please provide your date of birth.');
      return;
    }
    if (!codeOfConductAccepted) {
      setErrorMessage(
        'You must accept the EZ Esports Code of Conduct and Tournament Rules.'
      );
      return;
    }

    startTransition(async () => {
      try {
        const submission: PlayerOnboardingSubmission = {
          legalFirstName: legalFirstName.trim(),
          legalLastName: legalLastName.trim(),
          email: email.trim().toLowerCase(),
          password: isManager ? password : undefined,
          graduationYear,
          riotId: riotId.trim(),
          discordUsername: discordUsername.trim(),
          inGuild: true,
          birthDate,
          gender: gender || undefined,
          race: selectedRaces.length > 0 ? selectedRaces : undefined,
          countryOfBirth: countryOfBirth.trim() || undefined,
          primaryLanguageAtHome: primaryLanguageAtHome.trim() || undefined,
          isFreeOrReducedLunch,
          isFirstGenCollege,
          doePetitionConsent,
          surveyDetails: {
            ping,
            hoursPerWeek,
            internetReliability,
            careerInterests,
            feedback: feedback.trim() || undefined,
          },
          codeOfConductAccepted,
        };

        const result = await submitPlayerOnboarding({
          token,
          submission,
        });

        if (result.success) {
          setIsSubmitted(true);
        }
      } catch (err: any) {
        setErrorMessage(
          err.message || 'An error occurred while submitting your onboarding form.'
        );
      }
    });
  }

  function handleNext() {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    } else if (step === 3 && validateStep3()) {
      setStep(4);
    }
  }

  function handleBack() {
    setErrorMessage(null);
    if (step > 1) {
      setStep((prev) => prev - 1);
    }
  }

  // Success Confirmation Screen
  if (isSubmitted) {
    if (isManager) {
      return (
        <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
          <div className="bg-surface-elevated border border-border rounded-2xl p-8 sm:p-10 shadow-xl text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-500/5">
              <FiCheck className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                You have successfully signed up!
              </h1>
              <p className="text-foreground-muted text-sm sm:text-base">
                Welcome aboard,{' '}
                <span className="text-foreground font-semibold">
                  {legalFirstName} {legalLastName}
                </span>
                ! Your School Manager account for{' '}
                <span className="text-accent font-semibold">
                  {inviteData.schoolName}
                </span>{' '}
                has been created. Please sign in to access your school portal.
              </p>
            </div>

            <div className="bg-surface rounded-xl border border-border p-6 text-left space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-accent flex items-center gap-2">
                <FiShield className="w-4 h-4" /> Manager Portal Privileges Active
              </h2>
              <ul className="space-y-3 text-sm text-foreground-muted">
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    ✓
                  </span>
                  <span>
                    <strong className="text-foreground">Official Community Access:</strong>{' '}
                    Your Discord account ({discordUsername}) is registered for league announcements, referee comms, and manager channels.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    ✓
                  </span>
                  <span>
                    <strong className="text-foreground">Player Invites & Roster Review:</strong>{' '}
                    Generate player invite links for students at {inviteData.schoolName} and approve student submissions for tournament rosters.
                  </span>
                </li>
              </ul>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={`/portal/login?email=${encodeURIComponent(email)}`}
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-accent text-on-accent font-semibold text-sm hover:bg-accent/90 transition-colors shadow-sm"
              >
                Sign In to School Manager Portal &rarr;
              </Link>
              <Link
                href="/"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-surface transition-colors"
              >
                Return to Homepage
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
        <div className="bg-surface-elevated border border-border rounded-2xl p-8 sm:p-10 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-500/5">
            <FiCheck className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Application Submitted!
            </h1>
            <p className="text-foreground-muted text-sm sm:text-base">
              Welcome aboard,{' '}
              <span className="text-foreground font-semibold">
                {legalFirstName} {legalLastName}
              </span>
              ! Your player onboarding application for{' '}
              <span className="text-accent font-semibold">
                {inviteData.schoolName} ({inviteData.gameName})
              </span>{' '}
              has been successfully received.
            </p>
          </div>

          <div className="bg-surface rounded-xl border border-border p-6 text-left space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-accent flex items-center gap-2">
              <FiClock className="w-4 h-4" /> Next Steps Checklist
            </h2>
            <ul className="space-y-3 text-sm text-foreground-muted">
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                  ✓
                </span>
                <span>
                  <strong className="text-foreground">Stay in the Discord Server:</strong>{' '}
                  Keep your Discord account ({discordUsername}) joined in the official EZ Esports server for referee announcements, match check-ins, and voice comms.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                  2
                </span>
                <span>
                  <strong className="text-foreground">Manager Roster Review:</strong>{' '}
                  Your school coach or manager will review your submission and assign you to the active competition roster.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                  3
                </span>
                <span>
                  <strong className="text-foreground">Match Day Ready:</strong> Check your email ({email}) for tournament schedule releases and season kickoff details.
                </span>
              </li>
            </ul>
          </div>

          <div className="pt-4">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-accent text-on-accent font-semibold text-sm hover:bg-accent/90 transition-colors"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      {/* Top Personalized Greeting Banner */}
      <div className="mb-8 p-6 bg-surface-elevated border border-border rounded-2xl relative overflow-hidden shadow-sm">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-indigo-500 to-sky-400" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent mb-2">
              {isManager ? 'School Manager Onboarding' : 'Official Player Registration'}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              Welcome, {inviteData.intendedFirstName} {inviteData.intendedLastName}!
            </h1>
            <p className="text-foreground-muted text-sm mt-1">
              {isManager ? (
                <>
                  Complete your School Manager verification for{' '}
                  <span className="text-foreground font-semibold">
                    {inviteData.schoolName}
                  </span>
                </>
              ) : (
                <>
                  Complete your player onboarding for{' '}
                  <span className="text-foreground font-semibold">
                    {inviteData.schoolName}
                  </span>{' '}
                  —{' '}
                  <span className="text-accent font-semibold">
                    {inviteData.gameName}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saveDraftPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground-muted hover:text-foreground hover:bg-surface transition-colors disabled:opacity-50"
              title="Save current progress"
            >
              <FiSave className="w-3.5 h-3.5" />
              {saveDraftPending ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
        </div>

        {saveStatus && (
          <div className="mt-3 text-xs text-accent font-medium">{saveStatus}</div>
        )}
      </div>

      {/* Step Progression Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3 text-xs font-semibold text-foreground-muted">
          <span>Step {step} of 4</span>
          <span>
            {step === 1 && 'Student Information'}
            {step === 2 && 'Discord Voice & Community'}
            {step === 3 && 'Riot Game Identity'}
            {step === 4 && 'Demographics & Rules'}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all duration-300 ${
                s <= step ? 'bg-accent' : 'bg-surface-elevated border border-border'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Error Callout */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
          <FiAlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form Wizard Container */}
      <div className="bg-surface-elevated border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* STEP 1: Student Information */}
        {step === 1 && (
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">
                  Legal First Name *
                </label>
                <input
                  type="text"
                  value={legalFirstName}
                  onChange={(e) => setLegalFirstName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="e.g. Alex"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">
                  Legal Last Name *
                </label>
                <input
                  type="text"
                  value={legalLastName}
                  onChange={(e) => setLegalLastName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="e.g. Chen"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">
                {isManager ? 'Manager Email Address *' : 'Student Email Address *'}
              </label>
              <input
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

            {isManager && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">
                  Create Portal Account Password *
                </label>
                <input
                  type="password"
                  value={password}
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">
                {isManager
                  ? 'Affiliation / Academic Year *'
                  : 'Anticipated High School Graduation Year *'}
              </label>
              <select
                value={graduationYear}
                onChange={(e) => setGraduationYear(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {isManager ? (
                  <>
                    <option value={2025}>2024-2025</option>
                    <option value={2026}>2025-2026 (Current Academic Year)</option>
                    <option value={2027}>2026-2027</option>
                    <option value={2028}>2027-2028</option>
                  </>
                ) : (
                  <>
                    <option value={2025}>Class of 2025 (12th Grade / Senior)</option>
                    <option value={2026}>Class of 2026 (11th Grade / Junior)</option>
                    <option value={2027}>Class of 2027 (10th Grade / Sophomore)</option>
                    <option value={2028}>Class of 2028 (9th Grade / Freshman)</option>
                    <option value={2029}>Class of 2029 (8th Grade)</option>
                  </>
                )}
              </select>
            </div>
          </div>
        )}

        {/* STEP 2: Discord Connection */}
        {step === 2 && (
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
                  onChange={(e) => {
                    setDiscordUsername(e.target.value);
                  }}
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
        )}

        {/* STEP 3: Riot Games Identity */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Step 3: Riot Games Identity
              </h2>
              <p className="text-xs sm:text-sm text-foreground-muted mt-1">
                {isManager
                  ? 'Link your Riot Games ID for tournament operations, custom match hosting, and referee verification.'
                  : `Link your active Riot ID for ${inviteData.gameName}. This identifier is used for lobby invites and automatic comp ops stats.`}
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

            {/* Live Tracker.gg Profile URL Preview */}
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
        )}

        {/* STEP 4: Demographics & Research Survey */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Step 4: Demographics & Research Survey
              </h2>
              <p className="text-xs sm:text-sm text-foreground-muted mt-1">
                Help us keep high school esports free and accessible for all NYC students.
              </p>
            </div>

            {/* Zero-PII Strict Security Privacy Callout */}
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-xs sm:text-sm text-indigo-200">
                <FiShield className="w-4 h-4 shrink-0" />
                <span>Zero-PII Protection (FERPA & NYS Ed Law § 2-D Compliant)</span>
              </div>
              <p className="text-xs text-indigo-300/90 leading-relaxed">
                Your sensitive demographic responses (race, ethnicity, country of birth, lunch assistance) are encrypted in an isolated, permission-gated vault. They are used exclusively by authorized EZ Esports staff for state/foundation grant compliance and are <strong>strictly hidden from school managers, coaches, and opposing teams</strong>.
              </p>
            </div>

            {/* Core Demographics */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-accent">
                Demographic Background
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground-muted mb-1.5">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground-muted mb-1.5">
                    Gender Identity
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">Select gender identity...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Self-describe">Self-describe</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground-muted mb-1.5">
                  Race / Ethnicity (Select all that apply)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {RACE_ETHNICITY_OPTIONS.map((raceOption) => {
                    const checked = selectedRaces.includes(raceOption);
                    return (
                      <label
                        key={raceOption}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-accent/10 border-accent/40 text-foreground'
                            : 'bg-surface border-border text-foreground-muted hover:border-border/80'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRaces([...selectedRaces, raceOption]);
                            } else {
                              setSelectedRaces(
                                selectedRaces.filter((r) => r !== raceOption)
                              );
                            }
                          }}
                          className="h-3.5 w-3.5 rounded text-accent focus:ring-accent accent-accent"
                        />
                        <span>{raceOption}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground-muted mb-1.5">
                    Country of Birth
                  </label>
                  <input
                    type="text"
                    value={countryOfBirth}
                    onChange={(e) => setCountryOfBirth(e.target.value)}
                    placeholder="e.g. United States, Dominican Republic"
                    className="w-full px-3.5 py-2 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground-muted mb-1.5">
                    Primary Language Spoken at Home
                  </label>
                  <input
                    type="text"
                    value={primaryLanguageAtHome}
                    onChange={(e) => setPrimaryLanguageAtHome(e.target.value)}
                    placeholder="e.g. English, Spanish, Cantonese"
                    className="w-full px-3.5 py-2 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground-muted mb-1.5">
                    Free or Reduced-Price Lunch Eligible (Title I Metric)
                  </label>
                  <select
                    value={
                      isFreeOrReducedLunch === undefined
                        ? ''
                        : isFreeOrReducedLunch
                        ? 'true'
                        : 'false'
                    }
                    onChange={(e) =>
                      setIsFreeOrReducedLunch(
                        e.target.value === ''
                          ? undefined
                          : e.target.value === 'true'
                      )
                    }
                    className="w-full px-3.5 py-2 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">Select option...</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground-muted mb-1.5">
                    First-Generation College Student
                  </label>
                  <select
                    value={
                      isFirstGenCollege === undefined
                        ? ''
                        : isFirstGenCollege
                        ? 'true'
                        : 'false'
                    }
                    onChange={(e) =>
                      setIsFirstGenCollege(
                        e.target.value === ''
                          ? undefined
                          : e.target.value === 'true'
                      )
                    }
                    className="w-full px-3.5 py-2 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">Select option...</option>
                    <option value="true">Yes</option>
                    <option value="false">No / Unsure</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={doePetitionConsent}
                    onChange={(e) => setDoePetitionConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent accent-accent"
                  />
                  <span className="text-xs text-foreground-muted leading-relaxed">
                    I support the inclusion of scholastic esports as an officially recognized NYCDOE extracurricular activity.
                  </span>
                </label>
              </div>
            </div>

            {/* Tech & Gaming Survey */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-accent">
                Tech & Gaming Survey
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground-muted mb-1.5">
                    Average Home Ping
                  </label>
                  <select
                    value={ping}
                    onChange={(e) => setPing(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="< 20ms">&lt; 20ms</option>
                    <option value="20-40ms">20-40ms</option>
                    <option value="40-70ms">40-70ms</option>
                    <option value="70ms+">70ms+</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground-muted mb-1.5">
                    Gaming Hours / Week
                  </label>
                  <select
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="0-5 hrs">0-5 hrs</option>
                    <option value="6-10 hrs">6-10 hrs</option>
                    <option value="11-20 hrs">11-20 hrs</option>
                    <option value="20+ hrs">20+ hrs</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground-muted mb-1.5">
                    Internet Reliability
                  </label>
                  <select
                    value={internetReliability}
                    onChange={(e) => setInternetReliability(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="Fiber (Very stable)">Fiber (Very stable)</option>
                    <option value="Cable / Broadband (Stable)">Cable / Broadband (Stable)</option>
                    <option value="Wi-Fi (Occasional drops)">Wi-Fi (Occasional drops)</option>
                    <option value="Cell / Hotspot (Unstable)">Cell / Hotspot (Unstable)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground-muted mb-1.5">
                  Future Career Interests (Select all that apply)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {CAREER_INTEREST_OPTIONS.map((interest) => {
                    const checked = careerInterests.includes(interest);
                    return (
                      <label
                        key={interest}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-accent/10 border-accent/40 text-foreground'
                            : 'bg-surface border-border text-foreground-muted hover:border-border/80'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCareerInterests([...careerInterests, interest]);
                            } else {
                              setCareerInterests(
                                careerInterests.filter((i) => i !== interest)
                              );
                            }
                          }}
                          className="h-3.5 w-3.5 rounded text-accent focus:ring-accent accent-accent"
                        />
                        <span>{interest}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground-muted mb-1.5">
                  Anything else staff should know? (Optional)
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-lg bg-surface border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Schedule constraints, accommodations, questions..."
                />
              </div>
            </div>

            {/* Code of Conduct Signature */}
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
                  <strong>Code of Conduct & Rules Agreement *:</strong> I have read and agree to abide by the EZ Esports Rulebook, Code of Conduct, and Tournament Regulations. I understand that unsportsmanlike behavior, toxicity, or ringing will result in immediate disqualification.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Wizard Navigation Buttons */}
        <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-foreground-muted hover:text-foreground text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <FiChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-accent text-on-accent text-xs sm:text-sm font-semibold hover:bg-accent/90 transition-colors"
              >
                Continue <FiChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent text-on-accent text-xs sm:text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <FiClock className="w-4 h-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <FiCheck className="w-4 h-4" /> Complete Onboarding
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
