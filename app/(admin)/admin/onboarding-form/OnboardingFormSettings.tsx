'use client';

import { useState, useTransition } from 'react';
import { HiCheck, HiOutlineClipboard } from 'react-icons/hi2';
import { AdminField, AdminFormActions, AdminNotice, PendingLabel } from '@/app/components/admin/AdminUI';
import { input, primaryBtn, secondaryBtnSm } from '@/app/components/admin/styles';
import { saveOnboardingFormSettings } from './actions';

interface SettingsFormProps {
  initialUrl: string;
  initialEntryId: string;
}

/** Link and entry id of the form. Saving both blank turns the onboarding form off. */
export function OnboardingFormSettingsForm({ initialUrl, initialEntryId }: SettingsFormProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  function onSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await saveOnboardingFormSettings(formData);
      setMessage(
        result.success
          ? { tone: 'success', text: 'Saved. New onboarding submissions use this form straight away.' }
          : { tone: 'danger', text: result.error }
      );
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <AdminField
        label="Google Form link"
        htmlFor="onboarding-form-url"
        help="The link people open to fill the form in: docs.google.com/forms/d/e/.../viewform. Not the /edit link and not a forms.gle short link."
      >
        <input
          id="onboarding-form-url"
          name="formUrl"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          defaultValue={initialUrl}
          placeholder="https://docs.google.com/forms/d/e/.../viewform"
          className={input}
        />
      </AdminField>
      <AdminField
        label="Verification code entry id"
        htmlFor="onboarding-form-entry"
        help={'The number after "entry." for the Verification code question in a prefilled link, for example 1234567890.'}
      >
        <input
          id="onboarding-form-entry"
          name="entryId"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          defaultValue={initialEntryId}
          placeholder="1234567890"
          className={input}
        />
      </AdminField>
      <p className="text-xs leading-5 text-foreground-secondary">
        Leave both empty to turn the onboarding form off. Students and managers then skip that step.
      </p>
      {message && <AdminNotice tone={message.tone}>{message.text}</AdminNotice>}
      <AdminFormActions>
        <button type="submit" disabled={pending} aria-busy={pending} className={primaryBtn}>
          <PendingLabel pending={pending} label="Save settings" pendingLabel="Saving…" />
        </button>
      </AdminFormActions>
    </form>
  );
}

interface CopyBlockProps {
  label: string;
  value: string;
  /** Keep the value hidden until revealed; for the webhook key. */
  secret?: boolean;
  multiline?: boolean;
}

/** A value staff copy into another tool. Secrets stay masked until revealed. */
export function CopyBlock({ label, value, secret = false, multiline = false }: CopyBlockProps) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!secret);
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  }

  const shown = revealed ? value : '•'.repeat(24);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-foreground-secondary">{label}</span>
        <div className="flex items-center gap-2">
          {secret && (
            <button type="button" onClick={() => setRevealed((r) => !r)} aria-pressed={revealed} className={secondaryBtnSm}>
              {revealed ? 'Hide' : 'Show'}
            </button>
          )}
          <button type="button" onClick={copy} className={secondaryBtnSm}>
            {copied ? <HiCheck aria-hidden className="h-4 w-4" /> : <HiOutlineClipboard aria-hidden className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      {multiline ? (
        <pre
          tabIndex={0}
          aria-label={label}
          className="max-h-80 overflow-auto rounded-lg bg-surface-sunken p-3 font-mono text-xs leading-5 text-foreground whitespace-pre"
        >
          {shown}
        </pre>
      ) : (
        <p
          aria-label={label}
          className="break-all rounded-lg bg-surface-sunken px-3 py-2 font-mono text-xs leading-5 text-foreground"
        >
          {shown}
        </p>
      )}
      {failed && (
        <p role="alert" className="text-xs font-medium text-danger-on-tint">
          Could not copy automatically. Select the text and copy it by hand.
        </p>
      )}
    </div>
  );
}
