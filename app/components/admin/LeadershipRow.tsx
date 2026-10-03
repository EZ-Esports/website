'use client';

import { useState, useRef, useEffect } from 'react';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import RowIconButton from '@/app/components/admin/RowIconButton';
import SubmitButton from '@/app/components/admin/SubmitButton';
import ImageUpload from '@/app/components/admin/ImageUpload';
import { updateLeader, deleteLeader } from '@/app/(admin)/admin/leadership/actions';
import { AdminFormActions, AdminNotice } from '@/app/components/admin/AdminUI';
import { cancelBtn, chip, input, label as labelClass, td, tdRight, tr, trEditing, type ChipTone } from '@/app/components/admin/styles';
import { cx } from '@/app/lib/cx';

export interface LeaderRowItem {
  id: string; // termId
  termId?: string;
  personId: string;
  name: string;
  handle?: string | null;
  role: string;
  department?: string | null;
  year: string;
  displayOrder?: number;
  bio?: string | null;
  highSchool?: string | null;
  university?: string | null;
  avatarUrl?: string | null;
  storageKey?: string | null;
  schoolName?: string | null;
  graduationYear?: number | null;
  memberId?: string | null;
}

const inputClass = input;

const seniorityTone: Record<string, ChipTone> = {
  Executive: 'accent',
  Director: 'info',
  Advisor: 'violet',
  Associate: 'neutral',
};

export default function LeadershipRow({
  leader,
}: {
  leader: LeaderRowItem;
}) {
  const [editing, setEditing] = useState(false);
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

  const termId = leader.termId || leader.id;
  const deleteAction = deleteLeader.bind(null, termId, leader.year);
  const updateAction = updateLeader.bind(null, termId, leader.year);

  // Initials generator for fallback monogram
  const initials = leader.name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (editing) {
    return (
      <tr className={trEditing}>
        <td colSpan={4} className="px-5 py-4">
          <form
            action={async (formData) => {
              setSaveError(null);
              const res = await updateAction(formData);
              if (res && !res.success) {
                setSaveError(res.error || 'Could not save changes.');
                return;
              }
              closeEditing();
            }}
            className="admin-fade-in space-y-4 max-w-full"
          >
            <input type="hidden" name="personId" value={leader.personId} />

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* Left Column: Avatar Headshot Editor */}
              <div className="md:col-span-4">
                <ImageUpload
                  section="leadership"
                  entityId={leader.personId}
                  name="avatarUrl"
                  storageKeyName="storageKey"
                  currentSrc={leader.avatarUrl || ''}
                  currentStorageKey={leader.storageKey || ''}
                  label="Profile headshot"
                />
              </div>

              {/* Right Column: Person & Term Fields */}
              <div className="md:col-span-8 space-y-3 min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>
                      Full name
                    </label>
                    <input
                      ref={firstFieldRef}
                      name="name"
                      type="text"
                      required
                      defaultValue={leader.name}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Handle / IGN
                    </label>
                    <input
                      name="handle"
                      type="text"
                      placeholder="e.g. eddyson."
                      defaultValue={leader.handle ?? ''}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Role title
                    </label>
                    <input
                      name="role"
                      type="text"
                      required
                      defaultValue={leader.role}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Academic year
                    </label>
                    <input
                      name="year"
                      type="text"
                      required
                      pattern="[0-9]{4}"
                      title="Four-digit year, e.g. 2026"
                      defaultValue={leader.year}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Department
                    </label>
                    <input
                      name="department"
                      type="text"
                      placeholder="e.g. Executive, Operations"
                      defaultValue={leader.department ?? ''}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Seniority order
                    </label>
                    <select
                      name="displayOrder"
                      defaultValue={leader.displayOrder ?? 3}
                      className={inputClass}
                    >
                      <option value="1">1 - Executive (President, CTO, Founders)</option>
                      <option value="2">2 - Director / Lead (Dept & Game Leads)</option>
                      <option value="3">3 - Associate / Staff (Associates, Coordinators)</option>
                      <option value="4">4 - Advisor / Special Thanks</option>
                      <option value="0">0 - Other / Unspecified</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>
                      High school
                    </label>
                    <input
                      name="highSchool"
                      type="text"
                      placeholder="e.g. Stuyvesant High School"
                      defaultValue={leader.highSchool ?? ''}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      University
                    </label>
                    <input
                      name="university"
                      type="text"
                      placeholder="e.g. Columbia University"
                      defaultValue={leader.university ?? ''}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Graduation year
                    </label>
                    <input
                      name="graduationYear"
                      type="number"
                      placeholder="e.g. 2026"
                      defaultValue={leader.graduationYear ?? ''}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>
                    Bio / notes
                  </label>
                  <textarea
                    name="bio"
                    rows={2}
                    placeholder="Short student bio..."
                    defaultValue={leader.bio ?? ''}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {saveError && <AdminNotice tone="danger">{saveError}</AdminNotice>}

            <AdminFormActions>
              <button type="button" onClick={closeEditing} className={cancelBtn}>
                Cancel
              </button>
              <SubmitButton label="Save changes" pendingLabel="Saving…" size="sm" />
            </AdminFormActions>
          </form>
        </td>
      </tr>
    );
  }

  const schoolDisplay = leader.university
    ? leader.university
    : (leader.highSchool || (leader.schoolName ? `${leader.schoolName}${leader.graduationYear ? ` '${leader.graduationYear.toString().slice(-2)}` : ''}` : 'No school specified'));

  const seniorityTier =
    (leader.displayOrder ?? 3) === 1
      ? 'Executive'
      : (leader.displayOrder ?? 3) === 2
      ? 'Director'
      : (leader.displayOrder ?? 3) === 4
      ? 'Advisor'
      : 'Associate';

  return (
    <tr className={cx(tr, "group")}>
      {/* Officer Avatar & Identity */}
      <td className={cx(td, "min-w-0")}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-surface-raised flex-shrink-0 flex items-center justify-center overflow-hidden">
            {leader.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={leader.avatarUrl}
                alt={leader.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[11px] font-semibold text-foreground-secondary">
                {initials}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground text-sm flex items-center gap-1 truncate">
              <span className="truncate">{leader.name}</span>
              {leader.handle && (
                <span className="text-xs text-foreground-secondary font-normal shrink-0">({leader.handle})</span>
              )}
            </div>
            <div className="text-xs text-foreground-secondary truncate max-w-full">
              {schoolDisplay}
            </div>
          </div>
        </div>
      </td>

      {/* Role & Department */}
      <td className={cx(td, "min-w-0")}>
        <div className="font-medium text-foreground text-sm truncate">{leader.role}</div>
        {leader.department && (
          <span className="mt-0.5 block text-xs text-foreground-secondary truncate max-w-full">
            {leader.department}
          </span>
        )}
      </td>

      {/* Seniority Tier & Order */}
      <td className={td}>
        <span className={chip(seniorityTone[seniorityTier])}>
          {seniorityTier}
          <span className="tabular-nums opacity-70">#{leader.displayOrder ?? 0}</span>
        </span>
      </td>

      {/* Actions */}
      <td className={tdRight}>
        <div className="flex items-center gap-2 justify-end">
          <RowIconButton
            ref={editBtnRef}
            kind="edit"
            onClick={() => setEditing(true)}
            label={`Edit ${leader.name} (${leader.role}, ${leader.year})`}
          />
          <ConfirmDeleteButton
            action={deleteAction}
            label={`Remove ${leader.name} (${leader.role}, ${leader.year})`}
            message={`Remove ${leader.name} (${leader.role}, ${leader.year}) from leadership terms?`}
          />
        </div>
      </td>
    </tr>
  );
}
