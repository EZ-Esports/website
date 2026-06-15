'use client';

import { useState, useRef, useEffect } from 'react';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import SubmitButton from '@/app/components/admin/SubmitButton';
import { updateLeader, deleteLeader } from '@/app/(admin)/admin/leadership/actions';

interface Leader {
  id: string;
  name: string;
  role: string;
  year: string;
  bio: string | null;
}

const inputClass =
  'w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800/80 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-ez-pink/50 focus:border-ez-pink/30 transition-all';

export default function LeadershipRow({ leader }: { leader: Leader }) {
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

  const deleteAction = deleteLeader.bind(null, leader.id, leader.year);
  const updateAction = updateLeader.bind(null, leader.id, leader.year);

  if (editing) {
    return (
      <tr className="bg-slate-800/20 transition-colors">
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
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Name</label>
              <input ref={firstFieldRef} name="name" type="text" required defaultValue={leader.name} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Role</label>
              <input name="role" type="text" required defaultValue={leader.role} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Year</label>
              <input name="year" type="text" required pattern="[0-9]{4}" title="Four-digit year, e.g. 2026" defaultValue={leader.year} className={inputClass} />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Bio</label>
              <textarea name="bio" rows={3} defaultValue={leader.bio ?? ''} className={`${inputClass} resize-none`} />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={closeEditing}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-400 border border-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <SubmitButton
                label="Save"
                pendingLabel="Saving…"
                className="px-3 py-1.5 bg-ez-pink hover:bg-ez-pink/80 font-bold text-xs uppercase tracking-wider rounded-lg text-ez-black transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

  return (
    <tr className="hover:bg-slate-800/10 transition-colors">
      <td className="px-6 py-4">
        <div className="font-bold text-white text-base tracking-tight">{leader.name}</div>
        <div className="text-xs text-slate-400 max-w-xs truncate mt-1 leading-relaxed">
          {leader.bio || 'No bio provided.'}
        </div>
      </td>
      <td className="px-6 py-4 font-bold text-slate-200">{leader.role}</td>
      <td className="px-6 py-4 text-slate-300 font-semibold">{leader.year}</td>
      <td className="px-6 py-4 text-right">
        <div className="flex gap-2 justify-end">
          <button
            ref={editBtnRef}
            type="button"
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-200 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
          >
            Edit
          </button>
          <ConfirmDeleteButton
            action={deleteAction}
            label="Remove"
            message={`Remove ${leader.name} (${leader.role}, ${leader.year}) from the public leadership page?`}
            className="px-3 py-1.5 bg-slate-900 hover:bg-red-950/20 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-300 hover:text-red-400 border border-slate-800 hover:border-red-900/40 transition-all cursor-pointer"
          />
        </div>
      </td>
    </tr>
  );
}
