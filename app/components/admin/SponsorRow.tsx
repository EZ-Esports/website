'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import RowIconButton from '@/app/components/admin/RowIconButton';
import { cancelBtn, chip, chipButton, chipDot, fieldError, focusRing, input, label as labelClass, saveBtn, td, tdRight, tr, trEditing, type ChipTone } from '@/app/components/admin/styles';
import { AdminNotice, PendingLabel, RequiredMark } from '@/app/components/admin/AdminUI';
import { cx } from '@/app/lib/cx';
import { updateSponsor, toggleSponsorActive, deleteSponsor } from '@/app/(admin)/admin/sponsors/actions';
import ImageUpload from '@/app/components/admin/ImageUpload';

const tierTone: Record<string, ChipTone> = {
  platinum: 'neutral',
  gold: 'warning',
  community: 'info',
};

const tierLabel: Record<string, string> = {
  platinum: 'Platinum',
  gold: 'Gold',
  community: 'Community',
};

interface Sponsor {
  id: string;
  name: string;
  logoUrl: string | null;
  storageKey: string | null;
  tier: 'platinum' | 'gold' | 'community';
  websiteUrl: string | null;
  isActive: boolean | null;
  displayOrder: number | null;
}

const inputClass = input;

export default function SponsorRow({ sponsor }: { sponsor: Sponsor }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) firstFieldRef.current?.focus();
  }, [editing]);

  const closeEditing = () => {
    setEditing(false);
    setTimeout(() => editBtnRef.current?.focus(), 0);
  };

  const handleSave = (formData: FormData) => {
    setSaveError(null);
    startTransition(async () => {
      const res = await updateSponsor(sponsor.id, formData);
      if (res && !res.success) {
        setSaveError(res.error || 'Could not save changes.');
        return;
      }
      closeEditing();
    });
  };

  const handleToggleActive = () => {
    setToggleError(null);
    startTransition(async () => {
      const res = await toggleSponsorActive(sponsor.id, !sponsor.isActive);
      if (res && !res.success) setToggleError(res.error || 'Could not update status.');
    });
  };

  if (editing) {
    return (
      <tr className={trEditing}>
        <td colSpan={6} className="px-5 py-4">
          <form action={handleSave} className="admin-fade-in grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor={`edit-sponsor-${sponsor.id}-name`} className={labelClass}>
                Name <RequiredMark />
              </label>
              <input ref={firstFieldRef} id={`edit-sponsor-${sponsor.id}-name`} name="name" required defaultValue={sponsor.name} className={inputClass} />
            </div>
            <div>
              <ImageUpload
                section="sponsors"
                entityId={sponsor.id}
                name="logoUrl"
                storageKeyName="storageKey"
                currentSrc={sponsor.logoUrl ?? undefined}
                currentStorageKey={sponsor.storageKey ?? undefined}
                label="Change logo"
              />
            </div>
            <div>
              <label htmlFor={`edit-sponsor-${sponsor.id}-tier`} className={labelClass}>Tier</label>
              <select id={`edit-sponsor-${sponsor.id}-tier`} name="tier" defaultValue={sponsor.tier} className={inputClass}>
                <option value="platinum">Platinum</option>
                <option value="gold">Gold</option>
                <option value="community">Community</option>
              </select>
            </div>
            <div>
              <label htmlFor={`edit-sponsor-${sponsor.id}-websiteUrl`} className={labelClass}>Website URL</label>
              <input id={`edit-sponsor-${sponsor.id}-websiteUrl`} name="websiteUrl" defaultValue={sponsor.websiteUrl ?? ''} placeholder="https://…" className={inputClass} />
            </div>
            <div>
              <label htmlFor={`edit-sponsor-${sponsor.id}-displayOrder`} className={labelClass}>Display order</label>
              <input id={`edit-sponsor-${sponsor.id}-displayOrder`} name="displayOrder" type="number" defaultValue={sponsor.displayOrder ?? 0} className={inputClass} />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" disabled={isPending} aria-busy={isPending} className={saveBtn}><PendingLabel pending={isPending} label="Save" pendingLabel="Saving…" /></button>
              <button type="button" onClick={closeEditing} className={cancelBtn}>Cancel</button>
            </div>
            {saveError && (
              <AdminNotice tone="danger" className="sm:col-span-3">{saveError}</AdminNotice>
            )}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className={tr}>
      <td className={cx(td, "font-medium text-foreground")}>{sponsor.name}</td>
      <td className={td}>
        <span className={chip(tierTone[sponsor.tier] ?? 'neutral')}>
          {tierLabel[sponsor.tier] ?? sponsor.tier}
        </span>
      </td>
      <td className={td}>
        {sponsor.websiteUrl ? (
          <a
            href={sponsor.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cx("block max-w-[200px] truncate rounded text-foreground-secondary underline-offset-2 hover:text-foreground hover:underline transition-colors", focusRing)}
          >
            {sponsor.websiteUrl}
          </a>
        ) : (
          <span className="text-foreground-secondary">—</span>
        )}
      </td>
      <td className={td}>
        <button
          type="button"
          onClick={handleToggleActive}
          disabled={isPending}
          title={sponsor.isActive ? 'Click to mark inactive' : 'Click to mark active'}
          className={chipButton(sponsor.isActive ? 'success' : 'neutral')}
        >
          <span aria-hidden className={chipDot} />
          {sponsor.isActive ? 'Active' : 'Inactive'}
        </button>
        {toggleError && (
          <p role="alert" aria-live="polite" className={fieldError}>{toggleError}</p>
        )}
      </td>
      <td className={cx(td, "tabular-nums text-foreground-secondary")}>{sponsor.displayOrder}</td>
      <td className={tdRight}>
        <div className="flex items-center justify-end gap-2">
          <RowIconButton
            ref={editBtnRef}
            kind="edit"
            onClick={() => setEditing(true)}
            label={`Edit sponsor ${sponsor.name}`}
          />
          <ConfirmDeleteButton
            action={() => deleteSponsor(sponsor.id)}
            message={`Delete sponsor "${sponsor.name}"? This cannot be undone.`}
            label={`Delete sponsor ${sponsor.name}`}
          />
        </div>
      </td>
    </tr>
  );
}
