'use client';

import { useState, useTransition } from 'react';
import {
  FiAlertTriangle,
  FiSave,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiCheck,
} from 'react-icons/fi';
import {
  submitPlayerOnboarding,
  saveOnboardingDraft,
  type PlayerOnboardingSubmission,
} from '@/app/lib/onboarding/wizard-actions';
import { stepForRejection, type InviteData } from './types';
import { useWizardDraft } from './hooks/useWizardDraft';
import { WizardProgressStepper } from './components/WizardProgressStepper';
import { SuccessStep } from './components/SuccessStep';
import { AccountInfoStep } from './components/steps/AccountInfoStep';
import { DiscordStep } from './components/steps/DiscordStep';
import { GameIdentityStep } from './components/steps/GameIdentityStep';
import { DemographicsStep } from './components/steps/DemographicsStep';
import { ConsentStep } from './components/steps/ConsentStep';

export type { InviteData };

export const MANAGER_PASSWORD_REENTRY_NOTE =
  'Please re-enter your password. It is not kept while you connect Discord.';

/** Server-verified Discord identity (from the signed OAuth cookie), never typed by the student. */
export interface VerifiedDiscordView {
  username: string;
  inGuild: boolean;
}

interface PlayerOnboardingWizardProps {
  token: string;
  inviteData: InviteData;
  discord?: VerifiedDiscordView | null;
  /** Readable message from a failed Discord callback. */
  discordError?: string | null;
  /** True when returning from the Discord callback, so the wizard resumes at the Discord step. */
  resumeAtDiscord?: boolean;
}

export default function PlayerOnboardingWizard({
  token,
  inviteData,
  discord: discordProp = null,
  discordError = null,
  resumeAtDiscord = false,
}: PlayerOnboardingWizardProps) {
  const isManagerInvite = inviteData.role === 'manager';
  // The password is deliberately not kept in the saved draft, so a manager coming back from Discord
  // starts again at step 1 to re-enter it; a player resumes straight at the Discord step.
  const [step, setStep] = useState<number>(resumeAtDiscord && !isManagerInvite ? 2 : 1);
  const [isPending, startTransition] = useTransition();
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // Starts from the server-read cookie; cleared locally when the server later rejects it (e.g. it expired).
  const [discord, setDiscord] = useState<VerifiedDiscordView | null>(discordProp);
  const discordVerified = Boolean(discord?.inGuild);
  const draft = useWizardDraft(token, inviteData, {
    initialError:
      resumeAtDiscord && isManagerInvite
        ? [discordError, MANAGER_PASSWORD_REENTRY_NOTE].filter(Boolean).join(' ')
        : discordError,
    discordVerified,
  });
  const [discordConnecting, setDiscordConnecting] = useState(false);
  const { isManager } = draft;

  function handleNext() {
    if (step === 1 && draft.validateStep1()) {
      setStep(2);
    } else if (step === 2 && draft.validateStep2()) {
      setStep(3);
    } else if (step === 3 && draft.validateStep3()) {
      setStep(4);
    } else if (step === 4 && draft.validateStep4()) {
      setStep(5);
    }
  }

  /**
   * Saves progress first (the OAuth round trip is a full page navigation), then hands off to the
   * server route that signs state and redirects to Discord.
   */
  async function handleConnectDiscord() {
    setDiscordConnecting(true);
    draft.setErrorMessage(null);
    try {
      await saveOnboardingDraft({ token, draftData: draft.buildCurrentPayload() });
    } catch {
      // Losing the draft is not worth blocking the connection; the student can re-enter steps.
    }
    const qs = new URLSearchParams({
      token,
      school: inviteData.schoolSlug,
      game: inviteData.gameSlug,
    });
    window.location.assign(`/api/discord/start?${qs.toString()}`);
  }

  function handleBack() {
    draft.setErrorMessage(null);
    if (step > 1) {
      setStep((prev) => prev - 1);
    }
  }

  function handleSubmit() {
    if (!draft.validateStep5()) {
      return;
    }
    // A lost or short password would otherwise only fail on the server; send the manager back to fix it.
    if (isManager && !draft.validateStep1()) {
      setStep(1);
      return;
    }

    startTransition(async () => {
      try {
        const submission: PlayerOnboardingSubmission = {
          legalFirstName: draft.legalFirstName.trim(),
          legalLastName: draft.legalLastName.trim(),
          email: draft.email.trim().toLowerCase(),
          password: isManager ? draft.password : undefined,
          graduationYear: draft.graduationYear,
          academicYear: isManager ? draft.academicYear : undefined,
          riotId: draft.riotId.trim(),
          birthDate: draft.birthDate,
          gender: draft.gender || undefined,
          race: draft.selectedRaces.length > 0 ? draft.selectedRaces : undefined,
          countryOfBirth: draft.countryOfBirth.trim() || undefined,
          primaryLanguageAtHome: draft.primaryLanguageAtHome.trim() || undefined,
          isFreeOrReducedLunch: draft.isFreeOrReducedLunch,
          isFirstGenCollege: draft.isFirstGenCollege,
          doePetitionConsent: draft.doePetitionConsent,
          surveyDetails: {
            ping: draft.ping,
            hoursPerWeek: draft.hoursPerWeek,
            internetReliability: draft.internetReliability,
            careerInterests: draft.careerInterests,
            feedback: draft.feedback.trim() || undefined,
          },
          codeOfConductAccepted: draft.codeOfConductAccepted,
          consent: draft.buildConsent(),
        };

        const result = await submitPlayerOnboarding({
          token,
          submission,
        });

        if (!result.success) {
          // Expected rejections: send the invitee to the step that fixes them rather than a dead end.
          const target = stepForRejection(result.code);
          if (target === 2) setDiscord(null);
          setStep(target);
          draft.setErrorMessage(result.error);
          return;
        }
        setIsSubmitted(true);
      } catch (err: any) {
        draft.setErrorMessage(
          err.message || 'An error occurred while submitting your onboarding form.'
        );
      }
    });
  }

  if (isSubmitted) {
    return (
      <SuccessStep
        isManager={isManager}
        legalFirstName={draft.legalFirstName}
        legalLastName={draft.legalLastName}
        email={draft.email}
        discordUsername={discord?.username ?? ''}
        inviteData={inviteData}
      />
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
              onClick={draft.handleSaveDraft}
              disabled={draft.saveDraftPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground-muted hover:text-foreground hover:bg-surface transition-colors disabled:opacity-50"
              title="Save current progress"
            >
              <FiSave className="w-3.5 h-3.5" />
              {draft.saveDraftPending ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
        </div>

        {draft.saveStatus && (
          <div className="mt-3 text-xs text-accent font-medium">{draft.saveStatus}</div>
        )}
      </div>

      {/* Step Progression Indicator */}
      <WizardProgressStepper step={step} isManager={isManager} />

      {/* Error Callout */}
      {draft.errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
          <FiAlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <span>{draft.errorMessage}</span>
        </div>
      )}

      {/* Form Wizard Container */}
      <div className="bg-surface-elevated border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
        {step === 1 && (
          <AccountInfoStep
            legalFirstName={draft.legalFirstName}
            setLegalFirstName={draft.setLegalFirstName}
            legalLastName={draft.legalLastName}
            setLegalLastName={draft.setLegalLastName}
            email={draft.email}
            setEmail={draft.setEmail}
            password={draft.password}
            setPassword={draft.setPassword}
            graduationYear={draft.graduationYear}
            setGraduationYear={draft.setGraduationYear}
            academicYear={draft.academicYear}
            setAcademicYear={draft.setAcademicYear}
            isManager={isManager}
          />
        )}

        {step === 2 && (
          <DiscordStep
            verified={discord}
            connecting={discordConnecting}
            onConnect={handleConnectDiscord}
          />
        )}

        {step === 3 && (
          <GameIdentityStep
            riotId={draft.riotId}
            setRiotId={draft.setRiotId}
            ignConfirmed={draft.ignConfirmed}
            setIgnConfirmed={draft.setIgnConfirmed}
            isRiotIdValid={draft.isRiotIdValid}
            trackerUrl={draft.trackerUrl}
            isManager={isManager}
            gameName={inviteData.gameName}
          />
        )}

        {step === 4 && (
          <DemographicsStep
            birthDate={draft.birthDate}
            setBirthDate={draft.setBirthDate}
            gender={draft.gender}
            setGender={draft.setGender}
            selectedRaces={draft.selectedRaces}
            setSelectedRaces={draft.setSelectedRaces}
            countryOfBirth={draft.countryOfBirth}
            setCountryOfBirth={draft.setCountryOfBirth}
            primaryLanguageAtHome={draft.primaryLanguageAtHome}
            setPrimaryLanguageAtHome={draft.setPrimaryLanguageAtHome}
            isFreeOrReducedLunch={draft.isFreeOrReducedLunch}
            setIsFreeOrReducedLunch={draft.setIsFreeOrReducedLunch}
            isFirstGenCollege={draft.isFirstGenCollege}
            setIsFirstGenCollege={draft.setIsFirstGenCollege}
            doePetitionConsent={draft.doePetitionConsent}
            setDoePetitionConsent={draft.setDoePetitionConsent}
            ping={draft.ping}
            setPing={draft.setPing}
            hoursPerWeek={draft.hoursPerWeek}
            setHoursPerWeek={draft.setHoursPerWeek}
            internetReliability={draft.internetReliability}
            setInternetReliability={draft.setInternetReliability}
            careerInterests={draft.careerInterests}
            setCareerInterests={draft.setCareerInterests}
            feedback={draft.feedback}
            setFeedback={draft.setFeedback}
            codeOfConductAccepted={draft.codeOfConductAccepted}
            setCodeOfConductAccepted={draft.setCodeOfConductAccepted}
          />
        )}

        {step === 5 && (
          <ConsentStep
            age={draft.age}
            isMinor={draft.isMinor}
            tosAcknowledged={draft.tosAcknowledged}
            setTosAcknowledged={draft.setTosAcknowledged}
            participantLegalName={draft.participantLegalName}
            setParticipantLegalName={draft.setParticipantLegalName}
            guardianFullName={draft.guardianFullName}
            setGuardianFullName={draft.setGuardianFullName}
            guardianRelationship={draft.guardianRelationship}
            setGuardianRelationship={draft.setGuardianRelationship}
            guardianEmail={draft.guardianEmail}
            setGuardianEmail={draft.setGuardianEmail}
            guardianSignature={draft.guardianSignature}
            setGuardianSignature={draft.setGuardianSignature}
          />
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
            {step < 5 ? (
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
