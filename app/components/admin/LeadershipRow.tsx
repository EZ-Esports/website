'use client';

import { useState, useRef, useEffect } from 'react';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import SubmitButton from '@/app/components/admin/SubmitButton';
import ImageUpload from '@/app/components/admin/ImageUpload';
import { updateLeader, deleteLeader } from '@/app/(admin)/admin/leadership/actions';
import type { DBMember, School } from '@/app/types';

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

const inputClass =
  'w-full px-3 py-2 bg-surface-sunken border border-line/80 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/30 transition-all';

export default function LeadershipRow({
  leader,
  members,
  schools,
}: {
  leader: LeaderRowItem;
  members: DBMember[];
  schools: School[];
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

  const schoolMap = new Map(schools.map((s) => [s.id, s.name]));

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
      <tr className="bg-line/30 transition-colors">
        <td colSpan={5} className="p-6">
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
            className="space-y-6"
          >
            <input type="hidden" name="personId" value={leader.personId} />

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Left Column: Avatar Headshot Editor */}
              <div className="md:col-span-4 bg-surface-sunken/60 p-4 rounded-xl border border-line/60 space-y-3">
                <span className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                  Profile Headshot
                </span>
                <ImageUpload
                  name="avatarUrl"
                  storageKeyName="storageKey"
                  currentSrc={leader.avatarUrl || ''}
                  currentStorageKey={leader.storageKey || ''}
                  label="Headshot Avatar"
                />
              </div>

              {/* Right Column: Person & Term Fields */}
              <div className="md:col-span-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                      Full Name
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
                    <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
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
                    <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                      Role Title
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
                    <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                      Academic Year
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
                    <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
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
                    <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                      Display Order
                    </label>
                    <input
                      name="displayOrder"
                      type="number"
                      min="0"
                      max="99"
                      defaultValue={leader.displayOrder ?? 0}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                      High School
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
                    <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
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
                    <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                      Graduation Year
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
                  <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                    Associated League Member
                  </label>
                  <select
                    name="memberId"
                    className={inputClass}
                    defaultValue={leader.memberId ?? ''}
                  >
                    <option value="">None (Custom Profile)</option>
                    {members.map((m) => {
                      const schoolName = schoolMap.get(m.schoolId) || 'Unknown School';
                      const gradSuffix = m.graduationYear ? ` '${m.graduationYear.toString().slice(-2)}` : '';
                      return (
                        <option key={m.id} value={m.id}>
                          {m.firstName} {m.lastName} ({schoolName}{gradSuffix})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                    Bio / Notes
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

            {saveError && (
              <p role="alert" className="text-xs text-red-400">
                {saveError}
              </p>
            )}

            <div className="flex gap-2 justify-end pt-2 border-t border-line/60">
              <button
                type="button"
                onClick={closeEditing}
                className="px-4 py-2 bg-surface-raised hover:bg-line font-bold text-xs uppercase tracking-wider rounded-lg text-foreground-secondary border border-line transition-all cursor-pointer"
              >
                Cancel
              </button>
              <SubmitButton
                label="Save Changes"
                pendingLabel="Saving…"
                className="px-5 py-2 bg-accent hover:bg-accent/80 font-bold text-xs uppercase tracking-wider rounded-lg text-on-accent transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
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
    <tr className="hover:bg-line/10 transition-colors group">
      {/* Officer Avatar & Identity */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-surface-raised border border-line flex-shrink-0 flex items-center justify-center overflow-hidden">
            {leader.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={leader.avatarUrl}
                alt={leader.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-black text-foreground-secondary tracking-tight">
                {initials}
              </span>
            )}
          </div>
          <div>
            <div className="font-bold text-white text-base tracking-tight flex items-center gap-1.5">
              <span>{leader.name}</span>
              {leader.handle && (
                <span className="text-xs text-foreground-muted font-normal">({leader.handle})</span>
              )}
            </div>
            <div className="text-xs text-foreground-secondary max-w-xs truncate leading-relaxed">
              {schoolDisplay}
            </div>
          </div>
        </div>
      </td>

      {/* Role & Department */}
      <td className="px-6 py-4">
        <div className="font-bold text-foreground">{leader.role}</div>
        {leader.department && (
          <span className="inline-block mt-0.5 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-surface-raised border border-line text-foreground-secondary">
            {leader.department}
          </span>
        )}
      </td>

      {/* Seniority Tier & Order */}
      <td className="px-6 py-4">
        <span
          className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
            seniorityTier === 'Executive'
              ? 'bg-accent/20 text-accent border border-accent/30'
              : seniorityTier === 'Director'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : seniorityTier === 'Advisor'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'bg-surface-raised text-foreground-secondary border border-line'
          }`}
        >
          {seniorityTier}
          <span className="text-[10px] opacity-70">#{leader.displayOrder ?? 0}</span>
        </span>
      </td>

      {/* Academic Year */}
      <td className="px-6 py-4 text-foreground-secondary font-semibold">{leader.year}</td>

      {/* Actions */}
      <td className="px-6 py-4 text-right">
        <div className="flex gap-2 justify-end">
          <button
            ref={editBtnRef}
            type="button"
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 bg-surface-raised hover:bg-line font-bold text-xs uppercase tracking-wider rounded-lg text-foreground border border-line hover:border-line transition-all cursor-pointer"
          >
            Edit
          </button>
          <ConfirmDeleteButton
            action={deleteAction}
            label="Remove"
            message={`Remove ${leader.name} (${leader.role}, ${leader.year}) from leadership terms?`}
            className="px-3 py-1.5 bg-surface-raised hover:bg-red-950/20 font-bold text-xs uppercase tracking-wider rounded-lg text-foreground-secondary hover:text-red-400 border border-line hover:border-red-900/40 transition-all cursor-pointer"
          />
        </div>
      </td>
    </tr>
  );
}
