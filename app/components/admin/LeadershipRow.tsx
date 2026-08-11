'use client';

import { useState, useRef, useEffect } from 'react';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import SubmitButton from '@/app/components/admin/SubmitButton';
import { updateLeader, deleteLeader } from '@/app/(admin)/admin/leadership/actions';

import type { DBMember, School } from '@/app/types';

interface Leader {
  id: string;
  name: string;
  handle?: string | null;
  role: string;
  year: string;
  memberId: string | null;
  highSchool?: string | null;
  university?: string | null;
  schoolName: string | null;
  graduationYear: number | null;
}

const inputClass =
  'w-full px-3.5 py-2.5 bg-surface-sunken border border-line/80 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/30 transition-all';

export default function LeadershipRow({
  leader,
  members,
  schools,
}: {
  leader: Leader;
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

  const deleteAction = deleteLeader.bind(null, leader.id, leader.year);
  const updateAction = updateLeader.bind(null, leader.id, leader.year);

  if (editing) {
    return (
      <tr className="bg-line/20 transition-colors">
        <td colSpan={4} className="px-6 py-4">
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
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">Name</label>
              <input ref={firstFieldRef} name="name" type="text" required defaultValue={leader.name} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">Handle / IGN</label>
              <input name="handle" type="text" placeholder="e.g. eddyson." defaultValue={leader.handle ?? ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">Role</label>
              <input name="role" type="text" required defaultValue={leader.role} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">Year</label>
              <input name="year" type="text" required pattern="[0-9]{4}" title="Four-digit year, e.g. 2026" defaultValue={leader.year} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">High School</label>
              <input name="highSchool" type="text" placeholder="e.g. Stuyvesant High School" defaultValue={leader.highSchool ?? ''} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">University</label>
              <input name="university" type="text" placeholder="e.g. Columbia University" defaultValue={leader.university ?? ''} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">Associated Member</label>
              <select
                name="memberId"
                className={inputClass}
                defaultValue={leader.memberId ?? ''}
              >
                <option value="">None (Custom Name Only)</option>
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
            <div className="sm:col-span-2 lg:col-span-4 flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={closeEditing}
                className="px-3 py-1.5 bg-surface-raised hover:bg-line font-bold text-xs uppercase tracking-wider rounded-lg text-foreground-secondary border border-line transition-all cursor-pointer"
              >
                Cancel
              </button>
              <SubmitButton
                label="Save"
                pendingLabel="Saving…"
                className="px-3 py-1.5 bg-accent hover:bg-accent/80 font-bold text-xs uppercase tracking-wider rounded-lg text-on-accent transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            {saveError && (
              <p role="alert" className="sm:col-span-2 lg:col-span-4 text-xs text-red-400">{saveError}</p>
            )}
          </form>
        </td>
      </tr>
    );
  }

  const schoolDisplay = leader.university
    ? leader.university
    : (leader.highSchool || (leader.schoolName ? `${leader.schoolName}${leader.graduationYear ? ` '${leader.graduationYear.toString().slice(-2)}` : ''}` : 'No school specified'));

  return (
    <tr className="hover:bg-line/10 transition-colors">
      <td className="px-6 py-4">
        <div className="font-bold text-white text-base tracking-tight flex items-center gap-1.5">
          <span>{leader.name}</span>
          {leader.handle && <span className="text-xs text-foreground-muted font-normal">({leader.handle})</span>}
        </div>
        <div className="text-xs text-foreground-secondary max-w-xs truncate mt-1 leading-relaxed">
          {schoolDisplay}
        </div>
      </td>
      <td className="px-6 py-4 font-bold text-foreground">{leader.role}</td>
      <td className="px-6 py-4 text-foreground-secondary font-semibold">{leader.year}</td>
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
            message={`Remove ${leader.name} (${leader.role}, ${leader.year}) from the public leadership page?`}
            className="px-3 py-1.5 bg-surface-raised hover:bg-red-950/20 font-bold text-xs uppercase tracking-wider rounded-lg text-foreground-secondary hover:text-red-400 border border-line hover:border-red-900/40 transition-all cursor-pointer"
          />
        </div>
      </td>
    </tr>
  );
}
