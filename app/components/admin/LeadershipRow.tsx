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
  'w-full px-3 py-2 bg-surface-sunken border border-line/80 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/30 transition-all';

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
        <td colSpan={4} className="p-4">
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
            className="space-y-4 max-w-full"
          >
            <input type="hidden" name="personId" value={leader.personId} />

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* Left Column: Avatar Headshot Editor */}
              <div className="md:col-span-4 bg-surface-sunken/60 p-3 rounded-xl border border-line/60 space-y-2">
                <ImageUpload
                  name="avatarUrl"
                  storageKeyName="storageKey"
                  currentSrc={leader.avatarUrl || ''}
                  currentStorageKey={leader.storageKey || ''}
                  label="Profile Headshot"
                />
              </div>

              {/* Right Column: Person & Term Fields */}
              <div className="md:col-span-8 space-y-3 min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-foreground-secondary uppercase tracking-wider mb-1">
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
                    <label className="block text-[11px] font-bold text-foreground-secondary uppercase tracking-wider mb-1">
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
                    <label className="block text-[11px] font-bold text-foreground-secondary uppercase tracking-wider mb-1">
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
                    <label className="block text-[11px] font-bold text-foreground-secondary uppercase tracking-wider mb-1">
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
                    <label className="block text-[11px] font-bold text-foreground-secondary uppercase tracking-wider mb-1">
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
                    <label className="block text-[11px] font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                      Seniority Order
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-foreground-secondary uppercase tracking-wider mb-1">
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
                    <label className="block text-[11px] font-bold text-foreground-secondary uppercase tracking-wider mb-1">
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
                    <label className="block text-[11px] font-bold text-foreground-secondary uppercase tracking-wider mb-1">
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
                  <label className="block text-[11px] font-bold text-foreground-secondary uppercase tracking-wider mb-1">
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
                  <label className="block text-[11px] font-bold text-foreground-secondary uppercase tracking-wider mb-1">
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
                className="px-3.5 py-1.5 bg-surface-raised hover:bg-line font-bold text-xs uppercase tracking-wider rounded-lg text-foreground-secondary border border-line transition-all cursor-pointer"
              >
                Cancel
              </button>
              <SubmitButton
                label="Save Changes"
                pendingLabel="Saving…"
                className="px-4 py-1.5 bg-accent hover:bg-accent/80 font-bold text-xs uppercase tracking-wider rounded-lg text-on-accent transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
      <td className="px-3.5 py-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-surface-raised border border-line flex-shrink-0 flex items-center justify-center overflow-hidden">
            {leader.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={leader.avatarUrl}
                alt={leader.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[10px] font-black text-foreground-secondary tracking-tight">
                {initials}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-white text-xs tracking-tight flex items-center gap-1 truncate">
              <span className="truncate">{leader.name}</span>
              {leader.handle && (
                <span className="text-[10px] text-foreground-muted font-normal shrink-0">({leader.handle})</span>
              )}
            </div>
            <div className="text-[10px] text-foreground-secondary truncate max-w-full">
              {schoolDisplay}
            </div>
          </div>
        </div>
      </td>

      {/* Role & Department */}
      <td className="px-3.5 py-3 min-w-0">
        <div className="font-bold text-foreground text-xs truncate">{leader.role}</div>
        {leader.department && (
          <span className="inline-block mt-0.5 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-surface-raised border border-line text-foreground-secondary truncate max-w-full">
            {leader.department}
          </span>
        )}
      </td>

      {/* Seniority Tier & Order */}
      <td className="px-3.5 py-3">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
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
          <span className="text-[9px] opacity-70">#{leader.displayOrder ?? 0}</span>
        </span>
      </td>

      {/* Actions */}
      <td className="px-3.5 py-3 text-right">
        <div className="flex gap-1.5 justify-end">
          <button
            ref={editBtnRef}
            type="button"
            onClick={() => setEditing(true)}
            className="px-2.5 py-1 bg-surface-raised hover:bg-line font-bold text-[11px] uppercase tracking-wider rounded-lg text-foreground border border-line hover:border-line transition-all cursor-pointer"
          >
            Edit
          </button>
          <ConfirmDeleteButton
            action={deleteAction}
            label="Remove"
            message={`Remove ${leader.name} (${leader.role}, ${leader.year}) from leadership terms?`}
            className="px-2.5 py-1 bg-surface-raised hover:bg-red-950/20 font-bold text-[11px] uppercase tracking-wider rounded-lg text-foreground-secondary hover:text-red-400 border border-line hover:border-red-900/40 transition-all cursor-pointer"
          />
        </div>
      </td>
    </tr>
  );
}
