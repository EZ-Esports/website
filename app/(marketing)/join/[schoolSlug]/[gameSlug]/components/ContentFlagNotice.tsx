'use client';

import { FiAlertTriangle } from 'react-icons/fi';
import { ROUTES } from '@/app/lib/constants';
import { CONTENT_FIELDS, type ContentFieldKey } from '@/app/lib/onboarding/content-check';
import type { ContentFlagControls } from '../types';

/** Id for `aria-describedby` on the input the notice belongs to. */
export function contentNoticeId(field: ContentFieldKey): string {
  return `content-flag-${field}`;
}

/** Props that tie an input to its notice, spread onto the input. Empty while the field is clean. */
export function contentFieldProps(field: ContentFieldKey, controls?: ContentFlagControls) {
  const { flagged, overridden } = controls?.state(field) ?? { flagged: false, overridden: false };
  return flagged
    ? { 'aria-invalid': !overridden, 'aria-describedby': contentNoticeId(field) }
    : {};
}

/**
 * Shown under a field whose value looks offensive. It blocks Continue until the person either edits
 * the value or ticks the box to say it really is their information. The override is per field and
 * per value (see useWizardDraft), and staff are told about it, which the copy says plainly.
 * Renders nothing for a clean field, so steps can place it unconditionally.
 */
export function ContentFlagNotice({
  field,
  controls,
}: {
  field: ContentFieldKey;
  controls?: ContentFlagControls;
}) {
  const state = controls?.state(field);
  if (!controls || !state?.flagged) return null;
  const label = CONTENT_FIELDS[field].label;
  const id = contentNoticeId(field);

  return (
    <div
      id={id}
      className={`mt-2 rounded-lg border p-3 text-xs leading-relaxed ${
        state.overridden
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
          : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
      }`}
    >
      <p className="flex items-start gap-2">
        <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {state.overridden
            ? `Your ${label} will be sent to EZ Esports staff for review.`
            : `Your ${label} looks like it may contain offensive language. Offensive names, usernames and other information are not allowed. Please change it.`}
        </span>
      </p>
      <label className="mt-2 flex min-h-[44px] cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={state.overridden}
          onChange={(e) => controls.setOverride(field, e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-accent focus:ring-accent"
        />
        <span className="text-foreground">
          This is actually my real information. I understand staff will review it and it may be changed or
          rejected under the{' '}
          <a href={ROUTES.rules} target="_blank" rel="noreferrer" className="text-accent underline">
            league rules
          </a>
          .
        </span>
      </label>
    </div>
  );
}
