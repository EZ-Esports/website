'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { FiUsers } from 'react-icons/fi';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import RowIconButton from '@/app/components/admin/RowIconButton';
import { cancelBtn, chipButton, editIconBtn, chipDot, fieldError, focusRing, input, label as labelClass, saveBtn, td, tdRight, tr, trEditing } from '@/app/components/admin/styles';
import { AdminNotice, PendingLabel, RequiredMark } from '@/app/components/admin/AdminUI';
import { cx } from '@/app/lib/cx';
import { updateSchool, toggleSchoolActive, deleteSchool } from '@/app/(admin)/admin/schools/actions';
import ImageUpload from '@/app/components/admin/ImageUpload';
import SchoolManagersModal from '@/app/components/admin/SchoolManagersModal';

interface School {
  id: string;
  name: string;
  logoUrl: string | null;
  storageKey: string | null;
  websiteUrl: string | null;
  isActive: boolean | null;
  displayOrder: number | null;
}

const inputClass = input;

interface SchoolRowProps {
  school: School;
  games?: Array<{ id: string; displayName: string; slug: string; name?: string }>;
}

export default function SchoolRow({ school, games }: SchoolRowProps) {
  const [managersModalOpen, setManagersModalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Focus the first field when the form opens
  useEffect(() => {
    if (editing) firstFieldRef.current?.focus();
  }, [editing]);

  const closeEditing = () => {
    setEditing(false);
    // Return focus to the Edit trigger button
    setTimeout(() => editBtnRef.current?.focus(), 0);
  };

  const handleSave = (formData: FormData) => {
    setSaveError(null);
    startTransition(async () => {
      const res = await updateSchool(school.id, formData);
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
      const res = await toggleSchoolActive(school.id, !school.isActive);
      if (res && !res.success) setToggleError(res.error || 'Could not update status.');
    });
  };

  if (editing) {
    return (
      <tr className={trEditing}>
        <td colSpan={4} className="px-5 py-4">
          <form action={handleSave} className="admin-fade-in grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor={`edit-school-${school.id}-name`} className={labelClass}>
                Name <RequiredMark />
              </label>
              <input ref={firstFieldRef} id={`edit-school-${school.id}-name`} name="name" required defaultValue={school.name} className={inputClass} />
            </div>
            <div>
              <ImageUpload
                section="schools"
                entityId={school.id}
                name="logoUrl"
                storageKeyName="storageKey"
                currentSrc={school.logoUrl ?? undefined}
                currentStorageKey={school.storageKey ?? undefined}
                label="Change logo"
              />
            </div>
            <div>
              <label htmlFor={`edit-school-${school.id}-websiteUrl`} className={labelClass}>Website URL</label>
              <input id={`edit-school-${school.id}-websiteUrl`} name="websiteUrl" defaultValue={school.websiteUrl ?? ''} placeholder="https://…" className={inputClass} />
            </div>
            <input type="hidden" name="displayOrder" defaultValue={school.displayOrder ?? 0} />
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
      <td className={td}>
        <div className="flex items-center gap-3">
          {school.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={school.logoUrl}
              alt={`${school.name} logo`}
              className="w-8 h-8 object-contain rounded-md bg-surface-raised"
            />
          ) : (
            <div className="w-8 h-8 rounded-md bg-surface-raised flex items-center justify-center text-foreground-secondary text-xs font-semibold">
              {school.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="font-medium text-foreground">{school.name}</span>
        </div>
      </td>
      <td className={td}>
        {school.websiteUrl ? (
          <a
            href={school.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cx("block max-w-[200px] truncate rounded text-foreground-secondary underline-offset-2 hover:text-foreground hover:underline transition-colors", focusRing)}
          >
            {school.websiteUrl}
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
          title={school.isActive ? 'Click to mark inactive' : 'Click to mark active'}
          className={chipButton(school.isActive ? 'success' : 'neutral')}
        >
          <span aria-hidden className={chipDot} />
          {school.isActive ? 'Active' : 'Inactive'}
        </button>
        {toggleError && (
          <p role="alert" aria-live="polite" className={fieldError}>{toggleError}</p>
        )}
      </td>
      <td className={tdRight}>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setManagersModalOpen(true)}
            aria-label={`Manage portal managers for ${school.name}`}
            title={`Manage portal managers for ${school.name}`}
            className={cx(editIconBtn, 'hover:text-accent')}
          >
            <FiUsers aria-hidden="true" className="h-4 w-4" />
          </button>
          <RowIconButton
            ref={editBtnRef}
            kind="edit"
            onClick={() => setEditing(true)}
            label={`Edit school ${school.name}`}
          />
          <ConfirmDeleteButton
            action={() => deleteSchool(school.id)}
            message={`Delete school "${school.name}"? This cannot be undone.`}
            label={`Delete school ${school.name}`}
          />
        </div>
        <SchoolManagersModal
          school={school}
          games={games}
          isOpen={managersModalOpen}
          onOpenChange={setManagersModalOpen}
        />
      </td>
    </tr>
  );
}
