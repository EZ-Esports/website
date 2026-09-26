'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import RowIconButton from '@/app/components/admin/RowIconButton';
import { saveBtn, cancelBtn } from '@/app/components/admin/styles';
import { updateSchool, toggleSchoolActive, deleteSchool } from '@/app/(admin)/admin/schools/actions';
import ImageUpload from '@/app/components/admin/ImageUpload';

interface School {
  id: string;
  name: string;
  logoUrl: string | null;
  storageKey: string | null;
  websiteUrl: string | null;
  isActive: boolean | null;
  displayOrder: number | null;
}

const inputClass =
  'w-full px-3 py-2 rounded-lg bg-[#111111] border border-line text-white placeholder-foreground-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all';

export default function SchoolRow({ school }: { school: School }) {
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
      <tr className="bg-surface-raised/60">
        <td colSpan={5} className="py-4 px-3">
          <form action={handleSave} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                Name <span className="text-accent">*</span>
              </label>
              <input ref={firstFieldRef} name="name" required defaultValue={school.name} className={inputClass} />
            </div>
            <div>
              <ImageUpload
                section="schools"
                entityId={school.id}
                name="logoUrl"
                storageKeyName="storageKey"
                currentSrc={school.logoUrl ?? undefined}
                currentStorageKey={school.storageKey ?? undefined}
                label="Change Logo"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">Website URL</label>
              <input name="websiteUrl" defaultValue={school.websiteUrl ?? ''} placeholder="https://…" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">Display Order</label>
              <input name="displayOrder" type="number" defaultValue={school.displayOrder ?? 0} className={inputClass} />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" disabled={isPending} className={saveBtn}>{isPending ? 'Saving…' : 'Save'}</button>
              <button type="button" onClick={closeEditing} className={cancelBtn}>Cancel</button>
            </div>
            {saveError && (
              <p role="alert" className="sm:col-span-3 text-xs text-red-400">{saveError}</p>
            )}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-surface-raised/40 transition-colors">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3">
          {school.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={school.logoUrl}
              alt={`${school.name} logo`}
              className="w-8 h-8 object-contain rounded"
            />
          ) : (
            <div className="w-8 h-8 rounded bg-line flex items-center justify-center text-foreground-muted text-xs font-bold">
              {school.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="font-semibold text-white">{school.name}</span>
        </div>
      </td>
      <td className="py-3 pr-4">
        {school.websiteUrl ? (
          <a
            href={school.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground-secondary hover:text-white transition-colors truncate max-w-[180px] block"
          >
            {school.websiteUrl}
          </a>
        ) : (
          <span className="text-foreground-muted">—</span>
        )}
      </td>
      <td className="py-3 pr-4">
        <button
          onClick={handleToggleActive}
          disabled={isPending}
          className={`text-xs font-bold px-2.5 py-1 rounded-full cursor-pointer transition-all disabled:opacity-50 ${
            school.isActive ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-line text-foreground-muted hover:bg-line'
          }`}
        >
          {school.isActive ? 'Active' : 'Inactive'}
        </button>
        {toggleError && (
          <p role="alert" className="text-[10px] text-red-400 mt-1">{toggleError}</p>
        )}
      </td>
      <td className="py-3 pr-4 text-foreground-secondary">{school.displayOrder}</td>
      <td className="py-3 pr-2 text-right">
        <div className="flex items-center justify-end gap-2">
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
      </td>
    </tr>
  );
}
