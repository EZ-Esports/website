'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
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
  getVerifiedDiscordForInvite,
  type PlayerOnboardingSubmission,
} from '@/app/lib/onboarding/wizard-actions';
import { listenDiscordResult } from '@/app/lib/onboarding/discord-channel';
import { capitalizeNameWords } from '@/app/lib/onboarding/name-case';
import { FORM_STEP, stepForRejection, type InviteData } from './types';
import { useWizardDraft } from './hooks/useWizardDraft';
import { WizardProgressStepper } from './components/WizardProgressStepper';
import { SuccessStep } from './components/SuccessStep';
import { AccountInfoStep } from './components/steps/AccountInfoStep';
import { DiscordStep } from './components/steps/DiscordStep';
import { GameIdentityStep } from './components/steps/GameIdentityStep';
import { BirthDateRulesStep } from './components/steps/BirthDateRulesStep';
import { OnboardingFormStep } from './components/steps/OnboardingFormStep';
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
  /**
   * Staff-configured onboarding Google Form. When `enabled` the wizard has a sixth step and the server
   * refuses a submission until the form's completion is recorded. `completed` is the server's answer
   * at page load; it is never set from the browser alone.
   */
  onboardingForm?: { enabled: boolean; completed: boolean };
}

export default function PlayerOnboardingWizard({
  token,
  inviteData,
  discord: discordProp = null,
  discordError = null,
  resumeAtDiscord = false,
  onboardingForm = { enabled: false, completed: false },
}: PlayerOnboardingWizardProps) {
  // State, not a constant: the page-load answer can be stale (staff turned the form on while this page was
  // open) or missing (the lookup failed). The server's `onboarding_form_required` rejection is the authority
  // and switches the step on, so a student can never be stuck on a wizard that has no way to satisfy it.
  const [formEnabled, setFormEnabled] = useState<boolean>(onboardingForm.enabled);
  const totalSteps = formEnabled ? FORM_STEP : 5;
  const [formCompleted, setFormCompleted] = useState<boolean>(onboardingForm.completed);
  // The server's "form required" message, so it can be withdrawn once the completion shows up instead of
  // sitting in red next to the green "we received your form" state. Other errors are left alone.
  const formRequiredMessage = useRef<string | null>(null);
  const isManagerInvite = inviteData.role === 'manager';
  // The password is deliberately not kept in the saved draft, so a manager coming back from Discord
  // starts again at step 1 to re-enter it; a player resumes straight at the Discord step.
  const [step, setStep] = useState<number>(resumeAtDiscord && !isManagerInvite ? 2 : 1);
  const [isPending, startTransition] = useTransition();
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  // What the server reports about the player applications filed for a manager who also plays.
  const [applications, setApplications] = useState<{ created: number; existing: number }>({
    created: 0,
    existing: 0,
  });

  // Starts from the server-read cookie; cleared locally when the server later rejects it (e.g. it expired).
  const [discord, setDiscord] = useState<VerifiedDiscordView | null>(discordProp);
  const discordVerified = Boolean(discord?.inGuild);
  const draft = useWizardDraft(token, inviteData, {
    initialError:
      resumeAtDiscord && isManagerInvite
        ? [discordError, MANAGER_PASSWORD_REENTRY_NOTE].filter(Boolean).join(' ')
        : discordError,
    discordVerified,
    discordUsername: discord?.username ?? null,
  });
  const [discordConnecting, setDiscordConnecting] = useState(false);
  const { isManager } = draft;

  const handleFormCompleted = useCallback(
    (completed: boolean) => {
      setFormCompleted(completed);
      if (completed && formRequiredMessage.current) {
        const stale = formRequiredMessage.current;
        formRequiredMessage.current = null;
        draft.setErrorMessage((current) => (current === stale ? null : current));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setErrorMessage is a stable state setter
    [draft.setErrorMessage]
  );

  function handleNext() {
    if (step === 1 && draft.validateStep1()) {
      setStep(2);
    } else if (step === 2 && draft.validateStep2()) {
      setStep(3);
    } else if (step === 3 && draft.validateStep3()) {
      setStep(4);
    } else if (step === 4 && draft.validateStep4()) {
      setStep(5);
    } else if (step === 5 && formEnabled && draft.validateStep5()) {
      setStep(FORM_STEP);
    }
  }

  // The in-flight Discord tab: `stopWaitingRef` ends the wait (listeners, timers); the popup ref lets
  // Cancel close the tab we opened. Both are cleaned up on unmount.
  const stopWaitingRef = useRef<(() => void) | null>(null);
  const popupRef = useRef<Window | null>(null);
  // Mirrors state so click handlers and timers see the latest values without stale closures.
  const connectingRef = useRef(false);
  const discordRef = useRef<VerifiedDiscordView | null>(discordProp);
  useEffect(() => {
    discordRef.current = discord;
  }, [discord]);
  useEffect(() => () => stopWaitingRef.current?.(), []);

  /**
   * What the signed cookie says right now. `undefined` means the check itself failed (network),
   * which callers treat as "unknown", never as "not connected". The cross-tab message is never the identity.
   */
  const fetchVerifiedDiscord = useCallback(async (): Promise<VerifiedDiscordView | null | undefined> => {
    try {
      return await getVerifiedDiscordForInvite(token);
    } catch {
      return undefined;
    }
  }, [token]);

  /** Old behaviour: save the draft, then leave for Discord in this tab (the page unloads). */
  function connectInThisTab(qs: URLSearchParams) {
    void (async () => {
      try {
        await saveOnboardingDraft({ token, draftData: draft.buildCurrentPayload() });
      } catch {
        // Losing the draft is not worth blocking the connection; the student can re-enter steps.
      }
      window.location.assign(`/api/discord/start?${qs.toString()}`);
    })();
  }

  function cancelDiscordWait() {
    try {
      popupRef.current?.close();
    } catch {
      // The tab may already be gone.
    }
    stopWaitingRef.current?.();
  }

  /**
   * Opens Discord sign-in in a second tab so this tab keeps its step, fields, password and
   * overrides. `window.open` has to run synchronously inside the click for pop-up blockers; the
   * draft save is fired without waiting. A blocked tab (null, or already closed) falls back to the
   * same-tab redirect.
   *
   * The tab is opened without `noopener` on purpose: the wizard needs the returned handle to detect a
   * blocked pop-up and to poll `closed` when the person abandons the tab. The only page that could
   * reach `window.opener` is Discord's own sign-in (and our callback page), both trusted origins, and
   * nothing sensitive is reachable through it.
   */
  function handleConnectDiscord() {
    if (connectingRef.current) return;
    draft.setErrorMessage(null);
    const qs = new URLSearchParams({
      token,
      school: inviteData.schoolSlug,
      game: inviteData.gameSlug,
    });
    const popup = window.open(`/api/discord/start?${qs.toString()}&popup=1`, '_blank');

    connectingRef.current = true;
    setDiscordConnecting(true);
    if (!popup || popup.closed) {
      connectInThisTab(qs);
      return;
    }
    popupRef.current = popup;
    saveOnboardingDraft({ token, draftData: draft.buildCurrentPayload() }).catch(() => {});

    stopWaitingRef.current?.();
    const identityAtStart = discordRef.current;
    let finished = false;
    let refreshing = false;
    const intervals: number[] = [];

    const finish = () => {
      if (finished) return;
      finished = true;
      connectingRef.current = false;
      popupRef.current = null;
      stopWaitingRef.current = null;
      stopListening();
      intervals.forEach((t) => window.clearInterval(t));
      window.clearTimeout(capTimer);
      window.clearTimeout(blockedTimer);
      window.removeEventListener('focus', onFocus);
      setDiscordConnecting(false);
    };

    // Some blockers hand back a window that is closed a moment later.
    const blockedTimer = window.setTimeout(() => {
      if (!finished && popup.closed) {
        finish();
        connectingRef.current = true;
        setDiscordConnecting(true);
        connectInThisTab(qs);
      }
    }, 0);

    // The other tab finished and said so. Authoritative: re-read the server and show whatever it says.
    const onWake = async (message: { status: 'connected' | 'error'; error?: string }) => {
      if (finished) return;
      finish();
      const verified = await fetchVerifiedDiscord();
      if (verified !== undefined) setDiscord(verified);
      if (message.status === 'error' || !verified?.inGuild) {
        draft.setErrorMessage(message.error ?? 'We could not confirm your Discord connection. Please try again.');
      }
    };
    const stopListening = listenDiscordResult(inviteData.inviteId, onWake);

    // Safety net when no message arrives (storage blocked, message lost). One check at a time. While
    // the tab is still open, only a *different* identity than the one shown at the start counts: the
    // old cookie is expected until the new sign-in finishes, and must neither end the wait nor blank
    // the identity on screen. Once the tab has closed, the server's answer is final.
    const recheck = async (popupClosed: boolean) => {
      if (finished || refreshing) return;
      refreshing = true;
      try {
        const verified = await fetchVerifiedDiscord();
        if (finished) return;
        if (popupClosed) {
          finish();
          if (verified !== undefined) setDiscord(verified);
          if (!verified?.inGuild) draft.setErrorMessage('Discord was not connected. Please try again.');
          return;
        }
        const changed =
          verified &&
          (!identityAtStart ||
            verified.username !== identityAtStart.username ||
            verified.inGuild !== identityAtStart.inGuild);
        if (changed) {
          finish();
          setDiscord(verified);
        }
      } finally {
        refreshing = false;
      }
    };
    const onFocus = () => void recheck(Boolean(popup.closed));
    window.addEventListener('focus', onFocus);
    // Fast poll for "the tab was closed"; slow poll for a result whose message was lost.
    intervals.push(
      window.setInterval(() => {
        if (popup.closed) void recheck(true);
      }, 800)
    );
    intervals.push(window.setInterval(() => void recheck(Boolean(popup.closed)), 5000));
    // Give up after ten minutes (the flow cookie lasts far less).
    const capTimer = window.setTimeout(finish, 10 * 60_000);
    stopWaitingRef.current = finish;
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
    // Early feedback only: the server re-checks the recorded completion and is the authority.
    if (formEnabled && !formCompleted) {
      setStep(FORM_STEP);
      draft.setErrorMessage('Please finish the onboarding form on this step first. We will unlock the button as soon as we receive it.');
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
          legalFirstName: capitalizeNameWords(draft.legalFirstName),
          legalLastName: capitalizeNameWords(draft.legalLastName),
          email: draft.email.trim().toLowerCase(),
          password: isManager ? draft.password : undefined,
          graduationYear: draft.graduationYear,
          academicYear: isManager ? draft.academicYear : undefined,
          alsoPlays: isManager ? draft.alsoPlays : undefined,
          playGameIds: isManager && draft.alsoPlays ? draft.playGameIds : undefined,
          riotId: draft.riotId.trim(),
          birthDate: draft.birthDate,
          codeOfConductAccepted: draft.codeOfConductAccepted,
          consent: draft.buildConsent(),
          contentOverrides: draft.contentOverrideKeys(),
        };

        const result = await submitPlayerOnboarding({
          token,
          submission,
        });

        if (!result.success) {
          // Expected rejections: send the invitee to the step that fixes them rather than a dead end.
          const target = stepForRejection(result.code, result.fields);
          // Only a Discord rejection means the connection itself is bad; a flagged Discord username
          // keeps its connection so the person can override or switch accounts.
          if (target === 2 && result.code !== 'content_flagged') setDiscord(null);
          setStep(target);
          draft.setErrorMessage(result.error);
          if (result.code === 'play_games_required') draft.flagPlayGamesError();
          if (result.code === 'onboarding_form_required') {
            setFormEnabled(true);
            setFormCompleted(false);
            formRequiredMessage.current = result.error;
          }
          return;
        }
        setApplications({
          created: result.playerApplicationsCreated ?? 0,
          existing: result.playerApplicationsExisting ?? 0,
        });
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
        alsoPlays={isManager && draft.alsoPlays}
        applicationsCreated={applications.created}
        applicationsExisting={applications.existing}
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
              Welcome, {capitalizeNameWords(inviteData.intendedFirstName)} {capitalizeNameWords(inviteData.intendedLastName)}!
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
      <WizardProgressStepper step={step} isManager={isManager} totalSteps={totalSteps} />

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
            contentFlags={draft.contentFlags}
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
            alsoPlays={draft.alsoPlays}
            setAlsoPlays={draft.setAlsoPlays}
            playableGames={inviteData.playableGames}
            playGameIds={draft.playGameIds}
            playGamesErrorTick={draft.playGamesErrorTick}
            setPlayGameIds={draft.setPlayGameIds}
            isManager={isManager}
          />
        )}

        {step === 2 && (
          <DiscordStep
            contentFlags={draft.contentFlags}
            verified={discord}
            connecting={discordConnecting}
            onConnect={handleConnectDiscord}
            onCancel={cancelDiscordWait}
          />
        )}

        {step === 3 && (
          <GameIdentityStep
            contentFlags={draft.contentFlags}
            riotId={draft.riotId}
            setRiotId={draft.setRiotId}
            ignConfirmed={draft.ignConfirmed}
            setIgnConfirmed={draft.setIgnConfirmed}
            isRiotIdValid={draft.isRiotIdValid}
            trackerUrl={draft.trackerUrl}
            isManager={isManager && !draft.alsoPlays}
            gameName={inviteData.gameName}
          />
        )}

        {step === 4 && (
          <BirthDateRulesStep
            birthDate={draft.birthDate}
            setBirthDate={draft.setBirthDate}
            codeOfConductAccepted={draft.codeOfConductAccepted}
            setCodeOfConductAccepted={draft.setCodeOfConductAccepted}
            enforceStudentAge={!isManagerInvite}
          />
        )}

        {step === 5 && (
          <ConsentStep
            contentFlags={draft.contentFlags}
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

        {step === FORM_STEP && formEnabled && (
          <OnboardingFormStep token={token} completed={formCompleted} onCompletedChange={handleFormCompleted} />
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
            {step < totalSteps ? (
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
                aria-disabled={formEnabled && !formCompleted}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent text-on-accent text-xs sm:text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 aria-disabled:opacity-50"
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
