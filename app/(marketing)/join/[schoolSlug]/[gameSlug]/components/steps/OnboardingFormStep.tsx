'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FiAlertTriangle, FiCheck, FiClock, FiExternalLink } from 'react-icons/fi';
import {
  getOnboardingFormState,
  issueOnboardingFormLink,
} from '@/app/lib/onboarding/google-form-actions';

interface OnboardingFormStepProps {
  token: string;
  completed: boolean;
  onCompletedChange: (completed: boolean) => void;
}

const POLL_FAST_MS = 4_000;
const POLL_SLOW_MS = 15_000;
/** After this long without a result, poll less often. */
const SLOW_AFTER_MS = 10 * 60_000;
/** How long after opening the form before suggesting the usual causes of a missing confirmation. */
const HINT_AFTER_MS = 90_000;

/**
 * Last step when staff have configured the onboarding Google Form. The student opens a link with a
 * personal, short-lived verification code prefilled; Google's script reports the submission to the
 * server, and this step polls the server until it sees it. Nothing here can mark the step done by
 * itself: completion only ever comes from the server action.
 */
export function OnboardingFormStep({ token, completed, onCompletedChange }: OnboardingFormStepProps) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; expiresAt: number; openedAt: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [checking, setChecking] = useState(false);
  const startedAt = useRef(Date.now());

  const check = useCallback(async () => {
    try {
      const state = await getOnboardingFormState(token);
      if (state.completed) onCompletedChange(true);
    } catch {
      // A failed poll is "unknown", not "incomplete": the next tick tries again.
    }
  }, [token, onCompletedChange]);

  // Poll while this step is showing and not yet complete. Paused in a background tab, and checked
  // again the moment the student comes back from the form.
  useEffect(() => {
    if (completed) return;
    let timer: number | undefined;
    // Check straight away: the step may appear after a rejection for a student who already finished.
    void check();
    const schedule = () => {
      const delay = Date.now() - startedAt.current > SLOW_AFTER_MS ? POLL_SLOW_MS : POLL_FAST_MS;
      timer = window.setTimeout(async () => {
        if (!document.hidden) await check();
        schedule();
      }, delay);
    };
    schedule();
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [completed, check]);

  // Re-render periodically so the "link expired" and "still waiting" notices appear on time.
  useEffect(() => {
    if (completed) return;
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [completed]);

  async function openForm() {
    if (opening) return;
    setOpening(true);
    setError(null);
    // Opened synchronously inside the click so pop-up blockers allow it; pointed at the form once
    // the server has issued the code. The visible link below is the fallback when it is blocked.
    const tab = window.open('', '_blank');
    try {
      const result = await issueOnboardingFormLink(token);
      if (!result.ok) {
        tab?.close();
        setError(result.error);
        return;
      }
      setLink({ url: result.url, expiresAt: result.expiresAt, openedAt: Date.now() });
      setNow(Date.now());
      if (tab && !tab.closed) {
        tab.opener = null;
        tab.location.href = result.url;
      }
    } catch {
      tab?.close();
      setError('Could not open the form. Check your connection and try again.');
    } finally {
      setOpening(false);
    }
  }

  async function checkNow() {
    if (checking) return;
    setChecking(true);
    await check();
    setChecking(false);
  }

  const expired = Boolean(link && !completed && now > link.expiresAt);
  const waitingLong = Boolean(link && !completed && !expired && now - link.openedAt > HINT_AFTER_MS);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Step 6: Onboarding Form</h2>
        <p className="text-xs sm:text-sm text-foreground-muted mt-1">
          EZ Esports collects a short form from every player and school manager. Open it, answer it, and
          submit. Leave the verification code at the top exactly as it is: it is how we know the form came
          from you.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-surface border border-border space-y-4">
        <div role="status" aria-live="polite" className="space-y-3">
          {completed ? (
            <div className="flex items-start gap-3 p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
              <FiCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs sm:text-sm text-foreground">
                We received your form. You can finish onboarding.
              </p>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-foreground-muted leading-relaxed">
              {link
                ? 'Waiting for your submission. This page updates by itself a few seconds after you submit the form.'
                : 'You have not opened the form yet.'}
            </p>
          )}
          {expired && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10">
              <FiAlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs sm:text-sm text-foreground">
                The verification code in that link has expired, so a form submitted from it will not be
                recognised. Use <strong>Open the form again</strong> for a fresh link and submit the form once more.
              </p>
            </div>
          )}
          {waitingLong && (
            <p className="text-xs text-foreground-muted leading-relaxed">
              Still nothing? Make sure you pressed Submit on the last page of the form, and that you did not
              change the verification code. If you opened the form from another device, open it from here
              again.
            </p>
          )}
        </div>

        {!completed && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openForm}
              aria-disabled={opening}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-accent text-on-accent text-sm font-semibold hover:bg-accent/90 transition-colors aria-disabled:opacity-60"
            >
              {opening ? (
                <>
                  <FiClock className="w-4 h-4 animate-spin motion-reduce:animate-none" /> Opening...
                </>
              ) : (
                <>
                  <FiExternalLink className="w-4 h-4" /> {link ? 'Open the form again' : 'Open the form'}
                </>
              )}
            </button>
            {link && (
              <button
                type="button"
                onClick={checkNow}
                aria-disabled={checking}
                className="min-h-[44px] px-4 text-xs font-semibold text-foreground-muted hover:text-foreground underline aria-disabled:opacity-60"
              >
                {checking ? 'Checking...' : 'I submitted it, check now'}
              </button>
            )}
          </div>
        )}

        {link && !completed && (
          <p className="text-xs text-foreground-muted">
            Pop-up blocked?{' '}
            <a href={link.url} target="_blank" rel="noreferrer" className="text-accent underline">
              Open the form link
            </a>
            .
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs font-medium text-rose-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
